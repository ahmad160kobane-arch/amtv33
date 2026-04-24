#!/usr/bin/env node
'use strict';

/**
 * lulu-uploader — CLI
 *
 * الاستخدام:
 *   node index.js                        رفع من input.json
 *   node index.js --file mylist.json     رفع من ملف مخصص
 *   node index.js status                 معلومات الحساب
 *   node index.js pending                عرض قائمة الرفع الجارية
 *   node index.js check <file_code>      حالة ملف محدد
 */

const fs       = require('fs');
const path     = require('path');
const lulu     = require('./src/lulu-api');
const { uploadAll } = require('./src/uploader');

async function cmdStatus() {
  const info = await lulu.getAccountInfo();
  const r    = info.result;
  console.log('\n=== معلومات حساب LuluStream ===');
  console.log(`المستخدم        : ${r.login}`);
  console.log(`البريد          : ${r.email}`);
  console.log(`إجمالي الملفات  : ${r.files_total}`);
  console.log(`المساحة المستخدمة: ${(r.storage_used / 1e6).toFixed(1)} MB`);
  const leftDisplay = r.storage_left === 'unlimited' ? 'غير محدودة' : `${(Number(r.storage_left) / 1e9).toFixed(2)} GB`;
  console.log(`المساحة المتبقية : ${leftDisplay}`);
  console.log(`الرصيد          : $${r.balance}`);
  console.log(`Premium         : ${r.premium ? 'نعم' : 'لا'}`);
  if (r.premium) console.log(`انتهاء Premium  : ${r.premium_expire}`);
  console.log();
}

async function cmdPending() {
  const res = await lulu.checkUrlUploads();
  const list = res.result || [];
  console.log(`\n=== الرفع الجاري (${list.length} ملف) ===`);
  if (!list.length) {
    console.log('لا توجد ملفات قيد الرفع حالياً.\n');
    return;
  }
  list.forEach((f, i) => {
    console.log(`\n[${i + 1}] ${f.remote_url}`);
    console.log(`  الكود    : ${f.file_code || '—'}`);
    console.log(`  الحالة   : ${f.status}`);
    console.log(`  التقدم   : ${f.progress}%`);
    console.log(`  المجلد   : ${f.fld_id || '0'}`);
  });
  console.log();
}

async function cmdCheck(fileCode) {
  if (!fileCode) {
    console.error('الاستخدام: node index.js check <file_code>');
    process.exit(1);
  }
  const info = await lulu.getFileInfo(fileCode);
  const file = (info.result || [])[0];
  if (!file) {
    console.log(`الملف "${fileCode}" غير موجود أو لم يكتمل الرفع بعد.`);
    return;
  }
  console.log(`\n=== معلومات الملف: ${fileCode} ===`);
  console.log(`العنوان  : ${file.file_title}`);
  console.log(`الحالة   : ${file.canplay ? 'جاهز للتشغيل' : 'قيد المعالجة'}`);
  console.log(`المدة    : ${file.file_length} ثانية`);
  console.log(`المشاهدات: ${file.file_views}`);
  console.log(`الرابط   : https://lulustream.com/${fileCode}.html`);
  console.log();
}

async function cmdUpload(inputFile) {
  const inputPath = path.resolve(inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`\nالملف غير موجود: ${inputPath}`);
    console.error('قم بإنشاء input.json وفقاً للمثال في input.example.json\n');
    process.exit(1);
  }

  let items;
  try {
    items = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(`خطأ في قراءة ${inputFile}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.error('يجب أن يحتوي ملف الإدخال على مصفوفة بعنصر واحد على الأقل.');
    process.exit(1);
  }

  console.log(`تم تحميل ${items.length} عنصر من "${inputFile}"`);
  await uploadAll(items);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const command = args[0] || 'upload';

  try {
    if (command === 'status') {
      await cmdStatus();

    } else if (command === 'pending') {
      await cmdPending();

    } else if (command === 'check') {
      await cmdCheck(args[1]);

    } else {
      // upload (default)
      const fileIdx  = args.indexOf('--file');
      const inputFile = fileIdx >= 0 ? args[fileIdx + 1] : 'input.json';
      await cmdUpload(inputFile);
    }
  } catch (err) {
    console.error(`\nخطأ: ${err.message}\n`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
