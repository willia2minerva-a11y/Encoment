// scripts/resetAccounts.js
// الموقع: مشترك - سكربت يعمل مرة واحدة لحذف الحسابات القديمة
import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

async function resetAccounts() {
    console.log('🔄 بدء عملية حذف الحسابات القديمة...');
    console.log('');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات');
        console.log('');

        const db = mongoose.connection.db;
        const playersCollection = db.collection('players');

        // 1. الحصول على عدد اللاعبين الحالي
        const totalBefore = await playersCollection.countDocuments();
        console.log(`📊 عدد اللاعبين الحالي: ${totalBefore}`);

        // 2. الحصول على الأدمن الرئيسي (من ENV)
        const ADMIN_PSID = process.env.ADMIN_PSID;
        const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
        const rootAdmins = [
            ADMIN_PSID,
            ADMIN_TELEGRAM_ID ? `tg_${ADMIN_TELEGRAM_ID}` : null
        ].filter(Boolean);

        console.log(`👑 المدراء الرئيسيون: ${rootAdmins.length}`);

        // 3. حذف كل اللاعبين (بما فيهم الأدمن المسجلين في DB)
        // ملاحظة: الأدمن الرئيسي لا يحتاج حساباً في DB لأنه يُعرَّف من ENV
        
        console.log('');
        console.log('🗑️ جاري حذف جميع الحسابات...');

        const result = await playersCollection.deleteMany({});

        console.log(`✅ تم حذف ${result.deletedCount} حساب`);

        // 4. حذف قائمة المحظورين (اختياري)
        const bannedCollection = db.collection('bannedplayers');
        const bannedResult = await bannedCollection.deleteMany({});
        console.log(`✅ تم حذف ${bannedResult.deletedCount} محظور`);

        // 5. حذف جلسات الدخول/التسجيل (إن وُجدت)
        // ملاحظة: الجلسات في الذاكرة (RAM)، لا تحتاج حذف

        // 6. حذف custom tasks (اختياري)
        const tasksCollection = db.collection('customtasks');
        const tasksResult = await tasksCollection.deleteMany({});
        console.log(`✅ تم حذف ${tasksResult.deletedCount} مهمة مخصصة`);

        console.log('');
        console.log('🎉 تم إعادة تعيين البيانات بنجاح!');
        console.log('');
        console.log('📋 الخطوات التالية:');
        console.log('1. الأدمن الرئيسي (من ENV) يمكنه العمل مباشرة');
        console.log('2. أي لاعب آخر يجب أن ينشئ حساباً من جديد');
        console.log('3. ارفع الملفات الجديدة للعبة والسوق');
        console.log('4. أعد النشر في Render');

    } catch (error) {
        console.error('❌ خطأ:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('');
        console.log('✅ تم إغلاق الاتصال');
        process.exit(0);
    }
}

// تنفيذ
resetAccounts();
