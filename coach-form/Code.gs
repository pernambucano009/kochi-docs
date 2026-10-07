/**
 * KOCHI — استمارة انضمام المدرب → شيت "مدربو كوتشي v2"
 *
 * بيستقبل البيانات من join-coach.html ويضيفها كصف جديد في الشيت.
 * بيكتب كل قيمة تحت العمود اللي اسمه مطابق (حسب الصف الأول)،
 * ولو فيه حقل جديد مالوش عمود (زي "التخصص") بيضيف له عمود في الآخر.
 * صورة البروفايل بتتحفظ في فولدر على الدرايف ورابطها بيتكتب في الشيت.
 */

var SHEET_ID = '18vLVmuCT4wK_lbEnu-3pWap7LUSCnZNJ2pkHjR4xYxk'; // مدربو كوتشي v2
var SHEET_NAME = 'Sheet1';
var PHOTO_FOLDER_NAME = 'صور مدربي كوتشي';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var fields = data.fields || {};
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    if (data.photo && data.photo.base64) {
      fields['صورة البروفايل'] = savePhoto_(data.photo, fields['الاسم الكامل']);
    }
    fields['#'] = Math.max(sheet.getLastRow(), 1); // صف العناوين = 1، فأول مدرب = 1
    if (!fields['تاريخ التسجيل']) {
      fields['تاريخ التسجيل'] = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy/MM/dd HH:mm:ss');
    }
    fields['الحالة'] = 'جديد';

    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    Object.keys(fields).forEach(function (key) {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
        sheet.getRange(1, headers.length).setValue(key);
      }
    });

    var row = headers.map(function (h) {
      var v = fields[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.appendRow(row);

    return json_({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// افتح رابط الـ /exec في المتصفح: لو ظهر ok:true يبقى الربط شغال
function doGet() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  return json_({ ok: true, sheet: sheet.getParent().getName(), rows: sheet.getLastRow() });
}

function savePhoto_(photo, name) {
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  var blob = Utilities.newBlob(Utilities.base64Decode(photo.base64), photo.mimeType || 'image/jpeg',
    (name || 'coach') + ' - ' + new Date().getTime() + '.jpg');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// شغّل الدالة دي مرة واحدة من المحرر عشان توافق على صلاحيات الشيت والدرايف
function authorize() {
  SpreadsheetApp.openById(SHEET_ID).getName();
  DriveApp.getRootFolder();
}
