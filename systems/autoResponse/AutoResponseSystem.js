// systems/autoResponse/AutoResponseSystem.js
// الموقع: سوق ريو
export class AutoResponseSystem {
    constructor() {
        this.responses = {
            'مرحبا': 'أهلاً وسهلاً بك في سوق ريو!',
            'اهلا': 'أهلاً بك!',
            'شكرا': 'العفو!'
        };

        this.patterns = {
            'مرحب': 'مرحبا',
            'اهل': 'اهلا',
            'شكر': 'شكرا'
        };

        console.log('✅ نظام الردود التلقائي (السوق) تم تهيئته');
    }

    findAutoResponse(message) {
        const cleanMessage = message.toLowerCase().trim();
        if (this.responses[cleanMessage]) return this.responses[cleanMessage];

        for (const [pattern, responseKey] of Object.entries(this.patterns)) {
            if (cleanMessage.includes(pattern)) return this.responses[responseKey];
        }
        return null;
    }

    addResponse(trigger, response) {
        this.responses[trigger.toLowerCase()] = response;
        if (!this.patterns[trigger.toLowerCase()]) {
            this.patterns[trigger.toLowerCase()] = trigger.toLowerCase();
        }
        console.log(`✅ تم إضافة رد: ${trigger}`);
    }

    removeResponse(trigger) {
        const lowerTrigger = trigger.toLowerCase();
        if (this.responses[lowerTrigger]) {
            delete this.responses[lowerTrigger];
            if (this.patterns[lowerTrigger]) delete this.patterns[lowerTrigger];
            return true;
        }
        return false;
    }

    getAllResponses() {
        return this.responses;
    }
}
