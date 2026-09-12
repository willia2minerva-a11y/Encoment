// systems/card/BalanceCardGenerator.js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export class BalanceCardGenerator {
    constructor() {
        this.WIDTH = 800;
        this.HEIGHT = 450;
        this.FONT_FAMILY = 'Impact, Tahoma, Arial';
        this.OUTPUT_DIR = path.resolve('assets/balance_cards');
        this.BACKGROUNDS_DIR = path.resolve('assets/images');

        if (!fs.existsSync(this.OUTPUT_DIR)) {
            fs.mkdirSync(this.OUTPUT_DIR, { recursive: true });
        }
    }

    _generateSvgTextLayer(text, size, x, y, color = '#FFFFFF', fontWeight = 'bold', align = 'start') {
        return Buffer.from(`
            <svg width="${this.WIDTH}" height="${this.HEIGHT}">
                <style>
                    .text {
                        font-family: ${this.FONT_FAMILY};
                        font-size: ${size}px;
                        fill: ${color};
                        font-weight: ${fontWeight};
                        text-anchor: ${align};
                        dominant-baseline: hanging;
                        text-shadow: 2px 2px 4px #000000;
                    }
                </style>
                <text x="${x}" y="${y}" class="text">${text}</text>
            </svg>
        `);
    }

    async generateCard(player) {
        const width = this.WIDTH;
        const height = this.HEIGHT;

        try {
            // ✅ صورة الخلفية
            const backgroundFileName = 'balance_card.png';
            const backgroundPath = path.join(this.BACKGROUNDS_DIR, backgroundFileName);

            let imageProcessor;
            if (fs.existsSync(backgroundPath)) {
                imageProcessor = sharp(backgroundPath).resize(width, height);
            } else {
                // خلفية احتياطية - تدرج أزرق داكن
                imageProcessor = sharp({
                    create: {
                        width,
                        height,
                        channels: 3,
                        background: { r: 20, g: 30, b: 50, alpha: 1 }
                    }
                }).png();
            }

            const layers = [];

            // ✅ الاسم (ذهبي، كبير)
            const playerName = (player.name || 'مستخدم').toUpperCase();
            layers.push({
                input: this._generateSvgTextLayer(playerName, 50, width / 2, 100, '#FFD700', 'bold', 'middle'),
                left: 0, top: 0
            });

            // ✅ ID اللعبة (أبيض)
            const playerIdText = player.playerId || player.userId;
            layers.push({
                input: this._generateSvgTextLayer(`ID: ${playerIdText}`, 30, width / 2, 180, '#FFFFFF', 'bold', 'middle'),
                left: 0, top: 0
            });

            // ✅ كلمة "الرصيد" 
            layers.push({
                input: this._generateSvgTextLayer('💰 الرصيد', 35, width / 2, 250, '#E0E0E0', 'bold', 'middle'),
                left: 0, top: 0
            });

            // ✅ الرصيد (ذهبي، كبير جداً)
            const balance = player.gold || 0;
            layers.push({
                input: this._generateSvgTextLayer(`${balance} RIO`, 65, width / 2, 310, '#FFD700', 'bold', 'middle'),
                left: 0, top: 0
            });

            // ✅ شعار MGARA
            layers.push({
                input: this._generateSvgTextLayer('MGARA ECONOMY', 22, width / 2, 410, '#00BFFF', 'bold', 'middle'),
                left: 0, top: 0
            });

            // ✅ دمج الطبقات
            const outputBuffer = await imageProcessor
                .composite(layers)
                .png()
                .toBuffer();

            // ✅ حفظ
            const filename = `balance_${player.userId}_${Date.now()}.png`;
            const outputPath = path.join(this.OUTPUT_DIR, filename);
            await fs.promises.writeFile(outputPath, outputBuffer);

            return outputPath;

        } catch (error) {
            console.error('❌ خطأ في توليد البطاقة:', error);
            throw new Error('فشل في إنشاء بطاقة الرصيد: ' + error.message);
        }
    }

    // ✅ تنظيف الملفات القديمة
    async cleanupOldFiles() {
        try {
            const files = fs.readdirSync(this.OUTPUT_DIR);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.endsWith('.png')) {
                    const filePath = path.join(this.OUTPUT_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        } catch (error) {
            console.error('❌ خطأ في تنظيف البطاقات:', error);
        }
    }
}
