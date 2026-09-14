// core/MessageGateway.js
// الموقع: مشترك (مغارة ريو + سوق ريو)
// Purpose: Queue + Rate Control + Anti-Spam + 1893063 Handling

export default class MessageGateway {
    constructor({ sendText, sendImage, logger = console, name = 'Gateway' } = {}) {
        if (typeof sendText !== 'function') {
            throw new Error('MessageGateway: sendText required');
        }

        this.sendTextTransport = sendText;
        this.sendImageTransport = sendImage || null;
        this.logger = logger;
        this.name = name;

        // ⏱️ الفواصل الزمنية: 5-15 ثانية
        this.minIntervalMs = 5000;       // 5s minimum
        this.maxIntervalMs = 15000;      // 15s maximum
        this.spamIntervalMs = 16000;     // 16s if spam detected

        // 🚨 وضع السبام العام
        this.spamQueueThreshold = 20;    // queue > 20 → spam mode
        this.spamDurationMs = 5 * 60 * 1000;  // spam mode lasts 5 min
        this.spamUntil = 0;

        // 👤 فاصل كل لاعب (لمنع إغراق لاعب واحد)
        this.perUserMinIntervalMs = 3000;      // 3s min between messages to same user
        this.perUserSpamWindowMs = 60 * 1000;  // 60s window
        this.perUserSpamThreshold = 5;         // > 5 messages in 60s = spam
        this.perUserSpamIntervalMs = 20000;    // 20s if user is spammer
        this.userLastSent = new Map();
        this.userRecentSends = new Map();

        // 🚧 الحدود القصوى
        this.maxQueueSize = 500;
        this.maxQueueAgeMs = 24 * 60 * 60 * 1000;
        this.maxPerHour = 300;   // 5/min target
        this.maxPerDay = 6000;

        // 📊 العدادات
        this.hourStart = Date.now();
        this.dayStart = Date.now();
        this.hourlySent = 0;
        this.dailySent = 0;

        // 🔄 Retry
        this.maxRetries = 2;
        this.retryDelayMs = 60000;

        // 🧠 الحالة
        this.queue = [];
        this.processing = false;
        this.lastSentAt = 0;

        // 🛑 Circuit breaker for 1893063
        this.restrictionUntil = 0;
        this.restrictionLevel = 0;
        this.restrictionDurations = [
            30 * 60 * 1000,     // 30 min
            2 * 60 * 60 * 1000, // 2h
            6 * 60 * 60 * 1000, // 6h
            12 * 60 * 60 * 1000,// 12h
            24 * 60 * 60 * 1000 // 24h
        ];

        // 📈 إحصائيات
        this.stats = {
            sent: 0,
            failed: 0,
            dropped: 0,
            retried: 0,
            restrictions: 0,
            outOfWindow: 0,
            hourlyLimited: 0,
            spamModeEntries: 0
        };

        console.log(`📡 [${this.name}] تم التهيئة`);
        console.log(`   ⏱️ الفاصل: ${this.minIntervalMs / 1000}-${this.maxIntervalMs / 1000}s`);
        console.log(`   🚧 الحدود: ${this.maxPerHour}/ساعة | ${this.maxPerDay}/يوم`);
    }

    // ===================================
    // API الرئيسي
    // ===================================
    sendText(recipientId, text, options = {}) {
        return this._enqueue({
            type: 'text',
            recipientId,
            payload: text,
            priority: options.priority || 'normal',
            ttlMs: options.ttlMs || this.maxQueueAgeMs
        });
    }

    sendImage(recipientId, imagePath, caption = '', options = {}) {
        if (!this.sendImageTransport) {
            return Promise.reject(new Error('sendImage not configured'));
        }
        return this._enqueue({
            type: 'image',
            recipientId,
            payload: { imagePath, caption },
            priority: options.priority || 'high',
            ttlMs: options.ttlMs || this.maxQueueAgeMs
        });
    }

    _enqueue(item) {
        if (!item.recipientId) {
            return Promise.reject(new Error('recipientId required'));
        }

        // 🛑 متوقف بسبب تقييد
        if (this._isRestricted()) {
            const remaining = Math.ceil((this.restrictionUntil - Date.now()) / 60000);
            this.stats.dropped++;
            console.warn(`⏸️ [${this.name}] مقيّد (${remaining}د) — رفض رسالة`);
            return Promise.reject(new Error(`Restricted for ${remaining} min`));
        }

        // 🚧 حد الساعة
        this._resetCountersIfNeeded();
        if (this.hourlySent >= this.maxPerHour) {
            this.stats.hourlyLimited++;
            console.warn(`⏰ [${this.name}] تجاوز الحد الساعي (${this.maxPerHour}) — رفض`);
            return Promise.reject(new Error('Hourly limit reached'));
        }

        // 🚧 حد اليوم
        if (this.dailySent >= this.maxPerDay) {
            console.warn(`⏰ [${this.name}] تجاوز الحد اليومي — رفض`);
            return Promise.reject(new Error('Daily limit reached'));
        }

        // 🚧 حجم الطابور
        if (this.queue.length >= this.maxQueueSize) {
            const lowIdx = this.queue.findIndex(m => m.priority === 'low');
            if (lowIdx >= 0) {
                const dropped = this.queue.splice(lowIdx, 1)[0];
                dropped.reject(new Error('Queue overflow'));
                this.stats.dropped++;
            } else {
                this.stats.dropped++;
                return Promise.reject(new Error('Queue full'));
            }
        }

        let resolvePromise, rejectPromise;
        const queued = {
            ...item,
            createdAt: Date.now(),
            attempts: 0,
            sequence: Date.now() + Math.random(),
            promise: new Promise((res, rej) => {
                resolvePromise = res;
                rejectPromise = rej;
            }),
            resolve: resolvePromise,
            reject: rejectPromise
        };

        this.queue.push(queued);
        this._processQueue();
        return queued.promise;
    }

    // ===================================
    // معالجة الطابور
    // ===================================
    async _processQueue() {
        if (this.processing) return;
        this.processing = true;

        try {
            while (this.queue.length > 0) {
                this._removeExpired();

                if (this.queue.length === 0) break;

                // ⏸️ مقيّد
                if (this._isRestricted()) {
                    const wait = Math.min(60000, this.restrictionUntil - Date.now());
                    if (wait > 0) await this._sleep(wait);
                    continue;
                }

                // ⏰ حد الساعة
                this._resetCountersIfNeeded();
                if (this.hourlySent >= this.maxPerHour) {
                    const wait = this.hourStart + 60 * 60 * 1000 - Date.now();
                    if (wait > 0) {
                        console.log(`⏰ [${this.name}] الحد الساعي — انتظار ${Math.ceil(wait / 60000)}د`);
                        await this._sleep(Math.min(wait, 5 * 60 * 1000));
                        continue;
                    }
                }

                // ترتيب حسب الأولوية
                this.queue.sort((a, b) => {
                    const pr = { critical: 0, high: 1, normal: 2, low: 3 };
                    const diff = (pr[a.priority] ?? 2) - (pr[b.priority] ?? 2);
                    return diff || a.sequence - b.sequence;
                });

                const msg = this.queue.shift();

                try {
                    await this._waitForGlobalSlot();
                    await this._waitForUserSlot(msg.recipientId);

                    const result = await this._sendWithRetry(msg);

                    this.stats.sent++;
                    this.hourlySent++;
                    this.dailySent++;
                    this.lastSentAt = Date.now();
                    this.userLastSent.set(msg.recipientId, Date.now());
                    this._trackUserSend(msg.recipientId);

                    msg.resolve(result);
                } catch (error) {
                    this.stats.failed++;
                    msg.reject(error);
                }
            }
        } finally {
            this.processing = false;

            if (this.queue.length > 0 && !this._isRestricted()) {
                setTimeout(() => this._processQueue(), 1000);
            }
        }
    }

    // ===================================
    // الفاصل الزمني العام (5-15s + spam)
    // ===================================
    async _waitForGlobalSlot() {
        const interval = this._getCurrentInterval();
        const elapsed = Date.now() - this.lastSentAt;
        const wait = Math.max(0, interval - elapsed);
        if (wait > 0) await this._sleep(wait);
    }

    _getCurrentInterval() {
        // 🚨 وضع السبام
        if (Date.now() < this.spamUntil) {
            return this.spamIntervalMs;
        }

        // 🚧 طابور كبير → تفعيل السبام
        if (this.queue.length >= this.spamQueueThreshold) {
            this._enterSpamMode();
            return this.spamIntervalMs;
        }

        // 🎲 5-15 ثانية عشوائية
        const range = this.maxIntervalMs - this.minIntervalMs;
        return this.minIntervalMs + Math.floor(Math.random() * (range + 1));
    }

    _enterSpamMode() {
        if (Date.now() >= this.spamUntil) {
            this.spamUntil = Date.now() + this.spamDurationMs;
            this.stats.spamModeEntries++;
            console.log(`🚨 [${this.name}] وضع السبام (${this.queue.length} في الطابور) — فاصل 16s`);
        }
    }

    // ===================================
    // فاصل كل لاعب
    // ===================================
    async _waitForUserSlot(recipientId) {
        const last = this.userLastSent.get(recipientId) || 0;
        const recent = this.userRecentSends.get(recipientId) || [];

        const cutoff = Date.now() - this.perUserSpamWindowMs;
        const recentValid = recent.filter(t => t > cutoff);

        const isUserSpam = recentValid.length >= this.perUserSpamThreshold;
        const interval = isUserSpam ? this.perUserSpamIntervalMs : this.perUserMinIntervalMs;

        const wait = Math.max(0, interval - (Date.now() - last));
        if (wait > 0) await this._sleep(wait);
    }

    _trackUserSend(recipientId) {
        const now = Date.now();
        const cutoff = now - this.perUserSpamWindowMs;

        let recent = this.userRecentSends.get(recipientId) || [];
        recent = recent.filter(t => t > cutoff);
        recent.push(now);
        this.userRecentSends.set(recipientId, recent);

        // تنظيف كل فترة
        if (this.userRecentSends.size > 1000) {
            for (const [uid, times] of this.userRecentSends.entries()) {
                const valid = times.filter(t => t > cutoff);
                if (valid.length === 0) this.userRecentSends.delete(uid);
                else this.userRecentSends.set(uid, valid);
            }
        }
    }

    // ===================================
    // الإرسال مع Retry (bug fixed)
    // ===================================
    async _sendWithRetry(msg) {
        while (true) {
            try {
                if (msg.type === 'image') {
                    return await this.sendImageTransport(
                        msg.recipientId,
                        msg.payload.imagePath,
                        msg.payload.caption
                    );
                }
                return await this.sendTextTransport(msg.recipientId, msg.payload);
            } catch (error) {
                const kind = this._classifyError(error);

                // 🛑 1893063 - تقييد
                if (kind === 'restriction') {
                    this.stats.restrictions++;
                    this._activateRestriction();
                    throw error;
                }

                if (kind === 'out_of_window') {
                    this.stats.outOfWindow++;
                    throw error;
                }

                if (kind === 'permission') {
                    throw error;
                }

                const canRetry = msg.type === 'text';
                const canRetryError = (kind === 'rate_limit' || kind === 'temporary');

                if (canRetry && canRetryError && msg.attempts < this.maxRetries) {
                    msg.attempts++;  // ✅ إصلاح الـ bug
                    this.stats.retried++;
                    await this._sleep(this.retryDelayMs);
                    continue;
                }

                throw error;
            }
        }
    }

    _classifyError(error) {
        const data = error?.response?.data?.error || {};
        const code = Number(data.code);
        const subcode = Number(data.error_subcode);

        if (subcode === 1893063) return 'restriction';
        if (code === 613) return 'rate_limit';
        if (code === 10 && subcode === 2018278) return 'out_of_window';
        if (code === 190 || code === 200) return 'permission';

        const status = Number(error?.response?.status);
        if (status === 429 || status >= 500) return 'temporary';

        return 'permanent';
    }

    _activateRestriction() {
        const duration = this.restrictionDurations[
            Math.min(this.restrictionLevel, this.restrictionDurations.length - 1)
        ];

        this.restrictionUntil = Date.now() + duration;
        this.restrictionLevel = Math.min(
            this.restrictionLevel + 1,
            this.restrictionDurations.length - 1
        );

        const min = Math.round(duration / 60000);
        console.log(`🛑 [${this.name}] 1893063 — إيقاف ${min}د (المستوى ${this.restrictionLevel})`);
    }

    _isRestricted() {
        return Date.now() < this.restrictionUntil;
    }

    // ===================================
    // أدوات مساعدة
    // ===================================
    _resetCountersIfNeeded() {
        const now = Date.now();
        if (now - this.hourStart >= 60 * 60 * 1000) {
            this.hourStart = now;
            this.hourlySent = 0;
        }
        if (now - this.dayStart >= 24 * 60 * 60 * 1000) {
            this.dayStart = now;
            this.dailySent = 0;
        }
    }

    _removeExpired() {
        const now = Date.now();
        const kept = [];
        for (const msg of this.queue) {
            const ttl = msg.ttlMs || this.maxQueueAgeMs;
            if (now - msg.createdAt > ttl) {
                this.stats.dropped++;
                msg.reject(new Error('Expired'));
            } else {
                kept.push(msg);
            }
        }
        this.queue = kept;
    }

    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ===================================
    // الإحصائيات
    // ===================================
    getStatus() {
        const spamActive = Date.now() < this.spamUntil;
        return {
            name: this.name,
            queue: this.queue.length,
            processing: this.processing,
            restricted: this._isRestricted(),
            restrictionUntil: this.restrictionUntil || null,
            spamMode: spamActive,
            spamUntil: spamActive ? new Date(this.spamUntil).toISOString() : null,
            hourly: `${this.hourlySent}/${this.maxPerHour}`,
            daily: `${this.dailySent}/${this.maxPerDay}`,
            stats: { ...this.stats }
        };
    }

    startMonitor(intervalMs = 5 * 60 * 1000) {
        this._monitorInterval = setInterval(() => {
            const s = this.getStatus();
            if (s.stats.sent > 0 || s.queue > 0 || s.restricted) {
                console.log(
                    `📊 [${this.name}] ✅ ${s.stats.sent} | ❌ ${s.stats.failed} | ` +
                    `🗑️ ${s.stats.dropped} | ⏳ ${s.queue} | ` +
                    `⏰ ${s.hourly} | ${s.restricted ? '🛑' : s.spamMode ? '🚨' : '▶️'}`
                );
            }
        }, intervalMs);
    }

    async shutdown() {
        console.log(`🛑 [${this.name}] إيقاف...`);
        if (this._monitorInterval) clearInterval(this._monitorInterval);

        for (const msg of this.queue.splice(0)) {
            this.stats.dropped++;
            msg.reject(new Error('Shutdown'));
        }
    }
}
