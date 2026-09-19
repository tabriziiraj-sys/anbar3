import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { projectFiles } from './projectData';

function App() {
  const [downloading, setDownloading] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const downloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      
      projectFiles.forEach(file => {
        zip.file(file.path, file.content);
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'simple-web-app.zip');
    } catch (err) {
      console.error('Error creating zip:', err);
      alert('خطا در ساخت فایل ZIP');
    }
    setDownloading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
      {/* Header */}
      <header className="bg-gradient-to-l from-indigo-600 to-purple-700 text-white py-8 shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">سیستم مدیریت ساده</h1>
          <p className="text-indigo-100 text-lg">Node.js + Express + SQLite | آماده Deploy روی Liara</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Download Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">دانلود پروژه</h2>
              <p className="text-gray-600">فایل ZIP پروژه را دانلود کنید و روی Liara آپلود کنید</p>
            </div>
            <button
              onClick={downloadZip}
              disabled={downloading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 py-3 rounded-lg font-bold text-lg transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              {downloading ? '⏳ در حال ساخت...' : '📦 دانلود ZIP'}
            </button>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🚀 شروع سریع</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-2">اجرا در Windows</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 text-sm">
                <li>فایل ZIP را دانلود و Extract کنید</li>
                <li>فایل <code className="bg-gray-200 px-1 rounded">install.bat</code> را اجرا کنید</li>
                <li>فایل <code className="bg-gray-200 px-1 rounded">.env</code> را ویرایش کنید</li>
                <li>فایل <code className="bg-gray-200 px-1 rounded">start.bat</code> را اجرا کنید</li>
                <li>مرورگر باز می‌شود: <code className="bg-gray-200 px-1 rounded">http://localhost:3000</code></li>
              </ol>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-2">اطلاعات ورود اولیه</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">نام کاربری: <code className="bg-gray-200 px-2 py-0.5 rounded font-bold">admin</code></p>
                <p className="text-gray-600">رمز عبور: <code className="bg-gray-200 px-2 py-0.5 rounded font-bold">123456</code></p>
                <p className="text-gray-500 mt-2 text-xs">⚠️ حتماً رمز عبور را تغییر دهید</p>
              </div>
            </div>
          </div>
        </div>

        {/* Liara Deploy */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🌐 Deploy روی Liara</h2>
          <div className="space-y-3">
            {[
              'یک برنامه Node.js در Liara بسازید',
              'یک Persistent Disk بسازید (حداقل ۱ گیگ)',
              'Disk را به برنامه Mount کنید (مسیر: /data)',
              'متغیر DATABASE_PATH را /data/app.db تنظیم کنید',
              'متغیر SESSION_SECRET را با یک رشته تصادفی تنظیم کنید',
              'متغیر ADMIN_USERNAME و ADMIN_PASSWORD را تنظیم کنید',
              'متغیر NODE_ENV را production تنظیم کنید',
              'فایل ZIP را آپلود کنید',
              'Logها را بررسی کنید و تست کنید'
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="bg-indigo-100 text-indigo-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-700 pt-0.5">{step}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>مهم:</strong> حتماً DATABASE_PATH را روی Persistent Disk تنظیم کنید تا بعد از Restart اطلاعات پاک نشود.
            </p>
          </div>
        </div>

        {/* Environment Variables */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ متغیرهای محیطی</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-right p-3 font-bold text-gray-700">متغیر</th>
                  <th className="text-right p-3 font-bold text-gray-700">مقدار Local</th>
                  <th className="text-right p-3 font-bold text-gray-700">مقدار Liara</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-3 font-mono text-indigo-600">DATABASE_PATH</td>
                  <td className="p-3 font-mono text-sm">./data/app.db</td>
                  <td className="p-3 font-mono text-sm">/data/app.db</td>
                </tr>
                <tr className="border-t bg-gray-50">
                  <td className="p-3 font-mono text-indigo-600">SESSION_SECRET</td>
                  <td className="p-3 font-mono text-sm">my-secret-key</td>
                  <td className="p-3 font-mono text-sm">رشته تصادفی طولانی</td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-mono text-indigo-600">ADMIN_USERNAME</td>
                  <td className="p-3 font-mono text-sm">admin</td>
                  <td className="p-3 font-mono text-sm">admin</td>
                </tr>
                <tr className="border-t bg-gray-50">
                  <td className="p-3 font-mono text-indigo-600">ADMIN_PASSWORD</td>
                  <td className="p-3 font-mono text-sm">123456</td>
                  <td className="p-3 font-mono text-sm">رمز قوی</td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-mono text-indigo-600">PORT</td>
                  <td className="p-3 font-mono text-sm">3000</td>
                  <td className="p-3 font-mono text-sm">(خودکار)</td>
                </tr>
                <tr className="border-t bg-gray-50">
                  <td className="p-3 font-mono text-indigo-600">NODE_ENV</td>
                  <td className="p-3 font-mono text-sm">development</td>
                  <td className="p-3 font-mono text-sm">production</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Project Files */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📁 فایل‌های پروژه</h2>
          <p className="text-gray-600 text-sm mb-4">روی هر فایل کلیک کنید تا محتوای آن را ببینید</p>
          <div className="grid md:grid-cols-2 gap-2">
            {projectFiles.map(file => (
              <button
                key={file.path}
                onClick={() => setActiveFile(activeFile === file.path ? null : file.path)}
                className={`text-right p-3 rounded-lg border transition-all cursor-pointer ${
                  activeFile === file.path
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-mono text-sm text-gray-700">{file.path}</span>
              </button>
            ))}
          </div>
          
          {activeFile && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-700 font-mono text-sm">{activeFile}</h3>
                <button
                  onClick={() => setActiveFile(null)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-96 overflow-y-auto" dir="ltr">
                <code>{projectFiles.find(f => f.path === activeFile)?.content}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Architecture */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🏗️ معماری</h2>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="bg-blue-100 text-blue-800 px-6 py-3 rounded-lg font-bold">Browser</div>
            <div className="text-gray-400 text-2xl">↓</div>
            <div className="bg-green-100 text-green-800 px-6 py-3 rounded-lg font-bold">Express API</div>
            <div className="text-gray-400 text-2xl">↓</div>
            <div className="bg-purple-100 text-purple-800 px-6 py-3 rounded-lg font-bold">SQLite (app.db)</div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-4">
            تمام کاربران به یک دیتابیس مشترک روی سرور متصل هستند
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-6 text-center text-sm">
        <p>سیستم مدیریت ساده | Node.js + Express + SQLite</p>
        <p className="mt-1">آماده Deploy روی Liara.ir</p>
      </footer>
    </div>
  );
}

export default App;
