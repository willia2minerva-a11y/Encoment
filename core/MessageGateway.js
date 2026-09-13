 // core/MessageGateway.js
// الموقع: مشترك (مغارة ريو + سوق ريو)
// Purpose: Queue + Rate Control + Reputation Protection

export class MessageGateway {
    constructor(transport, options = {}) {
        if (!transport || typeof transport.send !== 'function') {
            throw new Error('MessageGateway: transport.send is required');
        }

        this.transport = transport;
        this.name = options.name || 'Gateway';

        // ============================================
        // ⚙️ إعدادات معدل الإرسال (بطيء ومقصود)
        // ============================================
        this.minIntervalMs = options.minIntervalMs || 5000;      // 5 ثواني أساس
        this.jitterMs = options.jitterMs || 3000;                // + 0-3 ثواني عشوائية
        this.maxQueueSize = options.maxQueueSize || 500;

        // ============================================
        // 🚧 الحدود القصوى (Hard Caps)
        // ============================================
        this.maxPerHour = options.maxPerHour || 150;             // 150 رسالة/ساعة
        this.maxPerDay = options.maxPerDay || 1500;              // 1500 رسالة/يوم

        // ============================================
        // 🔄 Retry
        // ============================================
        this.maxRetries = options.maxRetries || 2;
        this.retryDelayMs = options.retryDelayMs || 120000;      // دقيقتان

        // ============================================
        // 🧠 حالة Gateway
        // ============================================
        this.queue = [];
        this.processing = false;
        this.paused = false;
        this.pausedUntil = 0;
        this.pauseCount = 0;
        this.consecutiveErrors = 0;
        this.lastSendTime = 0;
        this.shuttingDown = false;

        // ============================================
        // 📊 عدادات (Hourly / Daily)
        // ============================================
        this.hourStart = Date.now();
        this.dayStart = Date.now();
        this.hourlySent = 0;
        this.dailySent = 0;

        // ============================================
        // 📈 إحصائيات
        // ============================================
        this.stats = {
            sent: 0,
            failed: 0,
            dropped: 0,
            retried: 0,
            totalPauses: 0,
            emergencyStops: 0
        };

        // ============================================
        // 🧹 Cleanup
        // ============================================
        this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);

        console.log(`📡 [${this.name}] تم التهيئة`);
        console.log(`   ⏱️ الفاصل: ${this.minIntervalMs / 1000}-${(this.minIntervalMs + this.jitterMs) / 1000} ثانية`);
        console.log(`   🚧 الحدود: ${this.maxPerHour}/ساعة | ${this.maxPerDay}/يوم`);
    }

    // ============================================
    // ✅ API الرئيسي
    // ============================================
    enqueue(message, priority = 'normal') {
        if (this.shuttingDown) {
            console.warn(`⚠️ [${this.name}] السيرفر يُغلق — تم تجاهل رسالة`);
            return false;
        }

        // حماية من امتلاء الطابور
        if (this.queue.length >= this.maxQueueSize) {
            this.stats.dropped++;
            console.warn(`⚠️ [${this.name}] الطابور ممتلئ — تم تجاهل رسالة`);
            return false;
        }

        this.queue.push({
            ...message,
            priority,
            queuedAt: Date.now(),
            attempts: 0
        });

        this._processQueue();
        return true;
    }

    // ============================================
    // 🔄 المعالجة الرئيسية
    // ============================================
    async _processQueue() {
        if (this.processing) return;
        this.processing = true;

        try {
            while (this.queue.length > 0 && !this.shuttingDown) {
                // ⏸️ إذا متوقف — انتظر
                if (this.paused) {
                    await this._waitForUnpause();
                    if (this.shuttingDown) break;
                }

                // 📊 فحص الحدود القصوى
                this._resetCountersIfNeeded();

                if (this.hourlySent >= this.maxPerHour) {
                    const wait = this.hourStart + 60 * 60 * 1000 - Date.now();
                    if (wait > 0) {
                        console.log(`⏰ [${this.name}] بلغنا الحد الساعي — انتظار ${Math.ceil(wait / 60000)} دقيقة`);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }
                }

                if (this.dailySent >= this.maxPerDay) {
                    const wait = this.dayStart + 24 * 60 * 60 * 1000 - Date.now();
                    if (wait > 0) {
                        console.log(`⏰ [${this.name}] بلغنا الحد اليومي — انتظار ${Math.ceil(wait / 3600000)} ساعة`);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }
                }

                // ✅ ترتيب حسب الأولوية
                this.queue.sort((a, b) => {
                    const order = { critical: 0, high: 1, normal: 2, low: 3 };
                    const diff = (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
                    if (diff !== 0) return diff;
                    return a.queuedAt - b.queuedAt;
                });

                const msg = this.queue.shift();

                // ⏱️ طبّق الفاصل الزمني
                await this._applyDelay();

                // 📤 حاول الإرسال
                const success = await this._sendWithRetry(msg);

                if (success) {
                    this.stats.sent++;
                    this.hourlySent++;
                    this.dailySent++;
                    this.consecutiveErrors = 0;
                }
            }
        } catch (error) {
            console.error(`❌ [${this.name}] خطأ في المعالجة:`, error.message);
        } finally {
            this.processing = false;

            // إذا وصلت رسائل جديدة أثناء المعالجة — أعد التشغيل
            if (this.queue.length > 0 && !this.shuttingDown && !this.paused) {
                setTimeout(() => this._processQueue(), 1000);
            }
        }
    }

    // ============================================
    // ⏱️ تطبيق الفاصل الزمني + Jitter
    // ============================================
    async _applyDelay() {
        const now = Date.now();
        const baseInterval = this.minIntervalMs;
        const jitter = Math.floor(Math.random() * this.jitterMs);
        const requiredInterval = baseInterval + jitter;

        const timeSinceLastSend = now - this.lastSendTime;

        if (timeSinceLastSend < requiredInterval) {
            const wait = requiredInterval - timeSinceLastSend;
            await new Promise(r => setTimeout(r, wait));
        }
    }

    // ============================================
    // 📤 الإرسال مع Retry
    // ============================================
    async _sendWithRetry(msg) {
        try {
            await this.transport.send(msg);
            this.lastSendTime = Date.now();
            return true;
        } catch (error) {
            const errorInfo = this._classifyError(error);

            // 🚨 1. تقييد من Meta (1893063 أو 613)
            if (errorInfo.type === 'rate_limit') {
                console.warn(`🚫 [${this.name}] تقييد Meta: ${errorInfo.message}`);
                this._pause();

                // أعِد الرسالة للطابور
                if (msg.attempts < this.maxRetries) {
                    msg.queuedAt = Date.now();
                    this.queue.unshift(msg);
                } else {
                    this.stats.dropped++;
                }
                return false;
            }

            // 🚪 2. خارج نافذة 24 ساعة → تجاهل فوري
            if (errorInfo.type === 'out_of_window') {
                console.warn(`🚪 [${this.name}] خارج نافذة 24 ساعة — تجاهل`);
                this.stats.dropped++;
                return false;
            }

            // 🔒 3. حظر الصفحة
            if (errorInfo.type === 'page_blocked') {
                console.error(`🔒 [${this.name}] الصفحة محظورة — توقف طارئ 24 ساعة`);
                this._emergencyStop();
                this.stats.dropped++;
                return false;
            }

            // 🔧 4. أخطاء أخرى → Retry
            console.error(`❌ [${this.name}] فشل:`, errorInfo.message);
            this.consecutiveErrors++;

            // حماية من الأخطاء المتكررة (Emergency Stop)
            if (this.consecutiveErrors >= 5) {
                console.error(`🚨 [${this.name}] 5 أخطاء متتالية — توقف طارئ 24 ساعة`);
                this._emergencyStop();
                this.stats.failed++;
                return false;
            }

            if (msg.attempts < this.maxRetries) {
                msg.attempts++;
                this.stats.retried++;
                this.stats.failed++;

                setTimeout(() => {
                    this.queue.push(msg);
                    this._processQueue();
                }, this.retryDelayMs);
                return false;
            }

            this.stats.failed++;
            return false;
        }
    }

    // ============================================
    // 🔍 تحليل أخطاء Meta
    // ============================================
    _classifyError(error) {
        const errData = error?.response?.data?.error;

        if (errData) {
            // 1893063 = تقييد الصفحة
            if (errData.code === 10 && errData.error_subcode === 1893063) {
                return { type: 'rate_limit', message: 'Page restricted (1893063)' };
            }

            // 613 = Rate limit عام
            if (errData.code === 613) {
                return { type: 'rate_limit', message: 'Rate limit (613)' };
            }

            // 2018278 = خارج نافذة 24 ساعة
            if (errData.code === 10 && errData.error_subcode === 2018278) {
                return { type: 'out_of_window', message: 'Out of 24h window' };
            }

            // 190 = Token
            if (errData.code === 190) {
                return { type: 'page_blocked', message: `Token invalid: ${errData.message}` };
            }

            // 200 = صلاحيات
            if (errData.code === 200) {
                return { type: 'permission', message: `Permission: ${errData.message}` };
            }

            return {
                type: 'unknown',
                message: `Meta ${errData.code}/${errData.error_subcode || '-'}: ${errData.message}`
            };
        }

        return { type: 'unknown', message: error.message || 'Unknown' };
    }

    // ============================================
    // ⏸️ إيقاف تدريجي (Pause with Backoff)
    // ============================================
    _pause() {
        this.pauseCount++;
        this.stats.totalPauses++;

        // تدرج: 30د → 2س → 6س → 12س → 24س
        const durations = [
            30 * 60 * 1000,         // 30 min
            2 * 60 * 60 * 1000,     // 2 hours
            6 * 60 * 60 * 1000,     // 6 hours
            12 * 60 * 60 * 1000,    // 12 hours
            24 * 60 * 60 * 1000     // 24 hours (max)
        ];
        const duration = durations[Math.min(this.pauseCount - 1, durations.length - 1)];

        this.paused = true;
        this.pausedUntil = Date.now() + duration;

        const until = new Date(this.pausedUntil).toLocaleString('ar-EG');
        console.log(`⏸️ [${this.name}] متوقف حتى ${until} (المرة ${this.pauseCount})`);
    }

    // ============================================
    // 🚨 إيقاف طارئ (24 ساعة)
    // ============================================
    _emergencyStop() {
        this.stats.emergencyStops++;
        this.paused = true;
        this.pausedUntil = Date.now() + 24 * 60 * 60 * 1000;
        this.consecutiveErrors = 0;

        const until = new Date(this.pausedUntil).toLocaleString('ar-EG');
        console.log(`🚨 [${this.name}] إيقاف طارئ حتى ${until}`);
    }

    async _waitForUnpause() {
        const waitTime = this.pausedUntil - Date.now();
        if (waitTime > 0) {
            await new Promise(r => setTimeout(r, waitTime));
        }
        this.paused = false;
        console.log(`▶️ [${this.name}] استئناف الإرسال`);
    }

    // ============================================
    // 🔄 إعادة تعيين العدادات
    // ============================================
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

    // ============================================
    // 🧹 تنظيف دوري
    // ============================================
    _cleanup() {
        // إزالة الرسائل القديمة جدًا (أكثر من 24 ساعة في الطابور)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const before = this.queue.length;
        this.queue = this.queue.filter(m => m.queuedAt > cutoff);
        const removed = before - this.queue.length;

        if (removed > 0) {
            this.stats.dropped += removed;
            console.log(`🧹 [${this.name}] تم حذف ${removed} رسالة قديمة`);
        }
    }

    // ============================================
    // 📊 الإحصائيات
    // ============================================
    getStats() {
        return {
            ...this.stats,
            queued: this.queue.length,
            paused: this.paused,
            pausedUntil: this.paused ? new Date(this.pausedUntil).toLocaleString('ar-EG') : null,
            pauseCount: this.pauseCount,
            consecutiveErrors: this.consecutiveErrors,
            hourlySent: `${this.hourlySent}/${this.maxPerHour}`,
            dailySent: `${this.dailySent}/${this.maxPerDay}`,
            processing: this.processing,
            shuttingDown: this.shuttingDown
        };
    }

    // ============================================
    // 🩺 Monitor دوري
    // ============================================
    startMonitor(intervalMs = 5 * 60 * 1000) {
        this._monitorInterval = setInterval(() => {
            const stats = this.getStats();
            if (stats.sent > 0 || stats.queued > 0 || stats.paused) {
                console.log(
                    `📊 [${this.name}] ✅ ${stats.sent} | ❌ ${stats.failed} | ` +
                    `🗑️ ${stats.dropped} | ⏳ ${stats.queued} | ` +
                    `⏰ ${stats.hourlySent} | ${stats.paused ? '⏸️' : '▶️'}`
                );
            }
        }, intervalMs);
    }

    // ============================================
    // 🔄 استئناف يدوي
    // ============================================
    resume() {
        if (this.paused) {
            this.paused = false;
            this.pausedUntil = 0;
            this.pauseCount = 0;
            this.consecutiveErrors = 0;
            console.log(`▶️ [${this.name}] استئناف يدوي`);
            this._processQueue();
        }
    }

    // ============================================
    // 🛑 إيقاف آمن (Graceful Shutdown)
    // ============================================
    async shutdown(timeoutMs = 30000) {
        console.log(`🛑 [${this.name}] بدء إيقاف آمن...`);
        this.shuttingDown = true;

        const start = Date.now();
        while (this.queue.length > 0 && Date.now() - start < timeoutMs) {
            await new Promise(r => setTimeout(r, 1000));
        }

        clearInterval(this._cleanupInterval);
        if (this._monitorInterval) clearInterval(this._monitorInterval);

        const remaining = this.queue.length;
        console.log(`🛑 [${this.name}] تم الإيقاف (${remaining} رسالة معلقة)`);
    }
                      }
