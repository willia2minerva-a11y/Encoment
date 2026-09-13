// systems/card/BalanceCardGenerator.js
// الموقع: سوق ريو
import fs from 'fs';
import path from 'path';

export class BalanceCardGenerator {
    constructor() {
        this.OUTPUT_DIR = path.resolve('assets/balance_cards');
        if (!fs.existsSync(this.OUTPUT_DIR)) {
            fs.mkdirSync(this.OUTPUT_DIR, { recursive: true });
        }
        console.log('💳 نظام بطاقة الرصيد تم تهيئته');
    }

    async generateCard(player) {
        try {
            // ✅ نولّد صورة SVG بسيطة
            const svg = this._generateSVG(player);
            const filename = `balance_${player.userId}_${Date.now()}.svg`;
            const outputPath = path.join(this.OUTPUT_DIR, filename);

            await fs.promises.writeFile(outputPath, svg);

            return outputPath;
        } catch (error) {
            console.error('❌ خطأ في توليد البطاقة:', error);
            throw new Error('فشل إنشاء البطاقة: ' + error.message);
        }
    }

    _generateSVG(player) {
        const username = (player.username || player.name || 'Player').toUpperCase();
        const playerId = player.playerId || 'N/A';
        const gold = player.gold || 0;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
        </linearGradient>
    </defs>

    <!-- الخلفية -->
    <rect width="800" height="450" fill="url(#bgGrad)"/>
    
    <!-- الحدود -->
    <rect x="10" y="10" width="780" height="430" 
          fill="none" stroke="#FFD700" stroke-width="3" rx="20"/>
    
    <!-- شعار سوق ريو -->
    <text x="400" y="60" font-family="Arial, sans-serif" font-size="28" 
          fill="#00BFFF" text-anchor="middle" font-weight="bold">
        🛒 SOUQ RIO - سوق ريو
    </text>
    
    <!-- الاسم -->
    <text x="400" y="150" font-family="Arial, sans-serif" font-size="50" 
          fill="url(#goldGrad)" text-anchor="middle" font-weight="bold">
        ${this._escape(username)}
    </text>
    
    <!-- الـ ID -->
    <text x="400" y="210" font-family="Arial, sans-serif" font-size="28" 
          fill="#FFFFFF" text-anchor="middle">
        ID: ${this._escape(playerId)}
    </text>
    
    <!-- الرصيد -->
    <text x="400" y="290" font-family="Arial, sans-serif" font-size="32" 
          fill="#E0E0E0" text-anchor="middle">
        💰 الرصيد
    </text>
    
    <text x="400" y="360" font-family="Arial, sans-serif" font-size="65" 
          fill="url(#goldGrad)" text-anchor="middle" font-weight="bold">
        ${gold} RIO
    </text>
</svg>`;
    }

    _escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    async cleanupOldFiles() {
        try {
            const files = fs.readdirSync(this.OUTPUT_DIR);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.endsWith('.svg') || file.endsWith('.png')) {
                    const filePath = path.join(this.OUTPUT_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        } catch (error) {
            console.error('❌ خطأ تنظيف:', error);
        }
    }
}
