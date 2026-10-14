# Panduan singkat untuk tutor

Semua yang perlu kamu lakukan ada di sini. Tidak ada istilah teknis yang rumit.

Isi panduan:

1. Menyiapkan Google Sheet (sekali saja)
2. Menyiapkan Apps Script (sekali saja)
3. Membuat aplikasi online di GitHub Pages (sekali saja)
4. Memasang aplikasi di HP
5. Cara membaca tab di Sheet
6. Mengubah token dan daftar nama
7. Halaman ringkasan untuk tutor
8. Kalau ada yang tidak jalan

---

## 1. Menyiapkan Google Sheet (sekali saja)

Sheet yang dipakai: [math_quiz_progress](https://docs.google.com/spreadsheets/d/1kym8bOSTbA1it_FN-0CDwLFuFAg06h5VVLsMYF9a2AM/edit)

**Penting: tutup akses sheet ini sekarang.**

1. Buka sheetnya.
2. Klik tombol **Bagikan** (Share) di kanan atas.
3. Kalau tertulis "Siapa saja yang memiliki link", klik **Ubah** (Change).
4. Pilih **Dibatasi** (Restricted). Hanya emailmu yang boleh membuka.
5. Klik **Selesai**.

Kalau langkah ini dilewati, siapa pun yang punya link bisa membaca semua nilai anakmu. Script tetap bisa menulis data walau sheetnya dibatasi, karena script berjalan sebagai kamu.

Catat **ID sheet** di alamatnya: `1kym8bOSTbA1it_FN-0CDwLFuFAg06h5VVLsMYF9a2AM`. Itu bukan rahasia, tapi jangan dihapus.

---

## 2. Menyiapkan Apps Script (sekali saja)

Script ini yang menerima jawaban dari HP dan mengisi tab-tab ringkasan.

1. Buka sheetnya.
2. Menu **Ekstensi** (Extensions) lalu **Apps Script**.
3. Hapus semua tulisan di file `Code.gs`, lalu tempel seluruh isi file `apps-script/Code.gs` dari folder proyek.
4. Simpan (Ctrl+S). Beri nama proyek: `math quiz`.
5. Klik **Terapkan** (Deploy) lalu **Terapkan baru** (New deployment).
6. Klik ikon roda gigi di sebelah "Pilih jenis", pilih **Aplikasi web** (Web app).
7. Isi seperti ini:
   - Keterangan: `math quiz v1`
   - Jalankan sebagai: **Saya**
   - Siapa yang punya akses: **Siapa saja**
8. Klik **Terapkan**.
9. Google akan minta izin. Klik **Berikan akses**, pilih akunmu, klik **Lanjutan** (Advanced), lalu **Buka proyek (tidak aman)**, lalu **Izinkan**.
10. Salin **URL aplikasi web**. Bentuknya seperti `https://script.google.com/macros/s/AKfy..../exec`.

Kirim URL itu (yang berakhiran `/exec`) ke saya, atau tempel sendiri di `js/config.js` pada baris `ENDPOINT`.

Cara mengetes scriptnya: buka URL `/exec` itu di browser. Kalau muncul tulisan `{"ok":true,...}` berarti script sudah jalan.

Kalau tulisan itu berbunyi "Add the tutor key to see the summary", artinya script juga sudah jalan, hanya halaman ringkasan yang menunggu kunci. Itu normal.

(Kalau ingin mengecek kesehatan script dengan pasti, tambahkan `?action=health` di belakang alamatnya.)

**Kalau nanti mengubah isi script, jangan klik "Terapkan baru" lagi.**

Klik **Terapkan** lalu **Kelola penerapan** (Manage deployments) lalu ikon pensil, pilih **Versi baru** (New version), klik **Terapkan**. Dengan begitu URL-nya tidak berubah. Kalau kamu memakai "Terapkan baru" terus, URL-nya ganti dan aplikasi di HP tidak bisa mengirim data lagi.

---

## 3. Membuat aplikasi online di GitHub Pages (sekali saja)

Repo: [dafielhaq/math-basic-quiz](https://github.com/dafielhaq/math-basic-quiz)

1. Buka repo itu di browser.
2. Klik **Settings** (Pengaturan).
3. Di menu kiri klik **Pages**.
4. Di bagian **Branch**, pilih `main` dan folder `/ (root)`, lalu klik **Save**.
5. Tunggu 1 sampai 2 menit. Alamat aplikasinya menjadi:
   `https://dafielhaq.github.io/math-basic-quiz/`

Cek dengan membukanya di HP. Kalau muncul halaman "Hai, Zaim", berarti sudah berhasil.

Kalau saya mengirim versi baru ke GitHub, kamu tidak perlu klik apa pun lagi. Aplikasi akan memperbarui dirinya sendiri. Perlu waktu sekitar 10 menit setelah saya mengirim, atau langsung saat aplikasi ditutup lalu dibuka lagi.

---

## 4. Memasang aplikasi di HP

1. Buka `https://dafielhaq.github.io/math-basic-quiz/` di Chrome Android.
2. Ketuk menu titik tiga di kanan atas.
3. Pilih **Tambahkan ke layar utama** (Add to Home screen) lalu **Tambahkan**.
4. Ikon akan muncul di layar utama. Bisa dibuka seperti aplikasi biasa.
5. Setelah dibuka sekali, aplikasi bisa dipakai tanpa internet. Jawaban disimpan dulu di HP, lalu dikirim sendiri saat ada internet.

---

## 5. Cara membaca tab di Sheet

Semua tab dibuat otomatis oleh script. Jangan mengetik apa pun di tab ringkasan, nanti tertimpa saat script memperbarui.

| Tab | Isinya |
|---|---|
| **Data** | Satu baris untuk setiap soal yang dijawab. Ini catatan mentah. Jangan diubah. |
| **Sessions** | Satu baris per sesi latihan: tanggal, mode, jumlah soal, benar, ketepatan, rata-rata waktu, dan topik yang belum ada jawaban benarnya. |
| **Topics** | Rata-rata semua sesi untuk setiap topik. Topik paling lemah ada di paling atas. |
| **Totals** | Jumlah sesi, jumlah soal, jumlah benar, ketepatan keseluruhan, total waktu latihan, tanggal sesi terakhir. |
| **Progress** | Ketepatan setiap topik per sesi, arah perkembangan (naik, turun, datar), dan grafik ketepatan keseluruhan per sesi. |
| **Tutor** | Tiga topik paling perlu dilatih dan tiga jenis kesalahan yang paling sering muncul. Ini yang dipakai untuk sesi di kertas. |
| **Rejected** | Baris yang ditolak: token salah atau nama tidak ada di daftar. Kalau tab ini bertambah terus, berarti ada yang mencoba mengirim data dengan token salah. |

Arti istilah:

- **Ketepatan** = jumlah benar dibagi jumlah soal, dalam persen.
- **Status topik** diambil dari **2 sesi terakhir topik itu**, supaya kesalahan lama tidak menutupi kemajuan:
  - **kuat** = 70 persen benar atau lebih
  - **sedang** = 40 sampai 69 persen
  - **lemah** = di bawah 40 persen
- **Pelan** = jawabannya benar tapi butuh lebih dari 10 detik. Bukan salah, hanya perlu dilatih supaya lebih cepat.
- **Tanda waktu** (kolom di tab Data) = `terlalu_cepat` kalau dijawab di bawah 2 detik. Biasanya itu tanda menebak. `terlalu_lama` kalau lebih dari 30 detik, mungkin ditinggal pergi.
- **Jenis kesalahan** = nama kesalahannya, misalnya `sign_error` (tanda minus salah), `order_ops` (urutan pengerjaan salah), `table_neighbor` (tertukar dengan tabel sebelahnya). Ada daftar lengkapnya di `docs/daftar-kesalahan.md`.

### Kalau waktu di bawah 200 baris per jam

Aplikasi hanya mengizinkan 200 baris masuk per jam. Kalau lebih, sisanya **tidak hilang**: tetap disimpan di HP dan dikirim lagi saat aplikasi dibuka berikutnya. Satu tes diagnostik itu 48 baris, jadi batas ini jarang terasa. Ubah angkanya di baris `ROWS_PER_HOUR` di script kalau perlu.

---

## 6. Mengubah token dan daftar nama

Keduanya ada di dua tempat yang harus cocok.

**Token** ada di:
- `apps-script/Code.gs` baris ke-13: `const TOKEN = '140514';`
- `js/config.js`: `TOKEN: '140514',`

**Daftar nama** hanya ada di script, baris ke-14: `const ALLOWED = ['Zaim'];`
Tambahkan nama lain seperti ini: `const ALLOWED = ['Zaim', 'Adik'];`

Langkah mengubah:

1. Ubah isinya di Apps Script (atau saya ubah di `js/config.js` lalu kirim ke GitHub).
2. Kalau script yang berubah: **Terapkan** lalu **Kelola penerapan** lalu pensil lalu **Versi baru** lalu **Terapkan**. URL-nya tetap sama.
3. Kalau `js/config.js` yang berubah: saya kirim ke GitHub, lalu aplikasi di HP akan mengambil versi barunya saat dibuka lagi.

Ganti token kalau tab **Rejected** bertambah banyak sekali, itu tanda tokennya sudah bocor.

---

## 7. Halaman ringkasan untuk tutor

Selain tab-tab di Sheet, ada satu halaman yang khusus untukmu. Isinya angka-angka yang sama, tapi disusun supaya cepat dibaca.

Yang tampil di halaman itu:

- Empat angka besar: jumlah sesi, soal dijawab, jumlah benar, dan ketepatan keseluruhan.
- Grafik ketepatan setiap sesi. Naik berarti cara belajarnya berhasil.
- Peta 24 topik, diurutkan dari yang paling perlu dilatih. Warnanya sama dengan yang dilihat anakmu di HP: merah lemah, kuning sedang, hijau kuat, dan tanda "pelan" untuk yang sudah benar tapi lambat.
- Klik satu topik untuk melihat riwayat topik itu per sesi dan kesalahan yang paling sering.
- Kartu terakhir: tiga topik paling perlu dilatih dan tiga kesalahan yang paling sering muncul, ditulis dengan kata biasa.

Halaman ini hanya bisa dibuka olehmu. Angkanya dihitung dari tab Data yang sama, jadi tidak mungkin berbeda dengan Sheet.

### Cara mengaktifkannya (sekali saja)

Perlu satu penerapan tambahan. Yang lama tidak diubah.

1. Buka Sheet, lalu menu **Ekstensi**, lalu **Apps Script**.
2. Tempel ulang seluruh isi `Code.gs` dari folder proyek (versi terbaru), lalu simpan.
3. Klik **Terapkan** lalu **Kelola penerapan**, klik ikon pensil pada penerapan yang sudah ada, pilih **Versi baru**, lalu **Terapkan**. Ini yang membuat aplikasi di HP tetap bisa mengirim data.
4. Klik **Terapkan** lagi, lalu **Terapkan baru**.
5. Klik ikon roda gigi, pilih **Aplikasi web**.
6. Atur seperti ini:
   - Keterangan: `ringkasan tutor`
   - Jalankan sebagai: **Saya**
   - Siapa yang punya akses: **Hanya saya**
7. Klik **Terapkan**, lalu salin URL yang berakhiran `/exec`.
8. Tempel di browser alamat itu, lalu tambahkan `?tutor=zaim-ringkasan` di belakangnya. Contoh:

   `https://script.google.com/macros/s/AKfy..../exec?tutor=zaim-ringkasan`

9. Simpan alamat itu sebagai penanda (bookmark) di HP dan di komputer.

Sejak saat itu, membuka penanda itu akan menampilkan ringkasan terbaru. Setiap kali kamu membukanya, angkanya dihitung ulang, jadi selalu yang terakhir.

### Mengubah kunci halaman

Kunci `zaim-ringkasan` ada di baris ke-42 `Code.gs`: `const DASHBOARD_KEY = 'zaim-ringkasan';`
Ganti isinya, lalu **Terapkan** lalu **Kelola penerapan** lalu pensil lalu **Versi baru** lalu **Terapkan**. Jangan lupa penanda di HP juga diperbarui.

Penerapan "Hanya saya" itu yang menahan orang lain. Kunci itu hanya lapisan kedua. Kalau kamu memakai URL penerapan yang publik, halamannya tetap bisa dibuka siapa pun yang tahu kuncinya, jadi pakai penerapan yang "Hanya saya".

---

## 8. Kalau ada yang tidak jalan

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Aplikasi bilang "Belum bisa dikirim: token tidak cocok" | Token di `js/config.js` tidak sama dengan token di script. Samakan keduanya. |
| Aplikasi bilang "Alamat endpoint belum diisi" | `ENDPOINT` di `js/config.js` masih kosong. Tempel URL `/exec`. |
| Data tidak muncul di tab Data | Buka URL `/exec` di browser. Kalau muncul `{"ok":true,...}` berarti script hidup. Kalau tidak, deploy ulang seperti langkah 6 di atas. |
| Tab **Rejected** bertambah | Ada kiriman dengan token salah atau nama di luar daftar. Cek token dan daftar nama. |
| Ringkasan tidak berubah | Di sheet, menu **Latihan MTK** lalu **Bangun ulang ringkasan**. |
| Aplikasi menampilkan versi lama | Tutup aplikasi sepenuhnya lalu buka lagi. |
| Halaman ringkasan minta login terus | Itu memang benar. Halaman itu hanya untuk akunmu. Login dengan akun yang sama seperti saat membuat script. |
| Halaman ringkasan hanya menampilkan tulisan `"ok":true` | Kunci di alamatnya salah atau hilang. Tambahkan `?tutor=zaim-ringkasan` di belakang alamat. |
| Halaman ringkasan bilang "Belum ada data" | Belum ada jawaban yang masuk ke tab Data. Jalankan tes diagnostik dulu di aplikasi HP. |
| Halaman ringkasan tidak berubah walau ada jawaban baru | Muat ulang halaman (tarik ke bawah). Angkanya dihitung saat halaman dibuka. |
