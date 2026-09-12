// data/bannedWords.js
export const bannedWords = [
    // إنجليزية
    'fuck', 'shit', 'bitch', 'ass', 'dick', 'cock', 'pussy',
    'sex', 'porn', 'nude', 'naked', 'bastard', 'whore',
    'slut', 'rape', 'nigga', 'nigger', 'fag', 'faggot',
    'admin', 'administrator', 'moderator', 'owner', 'root',
    'system', 'bot', 'official', 'support', 'staff',
    
    // عربية
    'كس', 'كسم', 'زب', 'زبي', 'شرموط', 'شرموطة', 'قحبة',
    'عاهرة', 'منيوك', 'منيوكة', 'طيز', 'خرا', 'زبالة',
    'كلب', 'خنزير', 'حمار', 'غبي', 'احمق', 'أحمق',
    'ادمن', 'أدمن', 'مدير', 'مسؤول', 'مالك', 'رسمي',
    
    // مركبات
    'fuckyou', 'fuckoff', 'sonofabitch', 'sonofbitch'
];

export function containsBannedWord(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    
    for (const word of bannedWords) {
        if (lower.includes(word.toLowerCase())) {
            return true;
        }
    }
    return false;
}
