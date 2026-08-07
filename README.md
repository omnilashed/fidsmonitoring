# FIDS Monitoring Dashboard

## Sinkronisasi database.sql via Git

File [database.sql](database.sql) sekarang sudah disertakan dalam repo dan bisa dipakai untuk memperbarui database lokal saat repo menerima perubahan.

### Langkah awal

1. Jalankan instalasi dependency:
   ```bash
   npm install
   ```
2. Jalankan sinkronisasi database manual pertama kali:
   ```bash
   npm run sync:db
   ```
3. Setelah itu, setiap kali Anda menjalankan `git pull`, hook Git akan otomatis memanggil sinkronisasi database.

### Konfigurasi yang otomatis dibuat

- `npm install` akan mengatur `core.hooksPath` ke `.githooks`.
- Hook Git yang dipakai adalah `.githooks/post-merge` (dan `.githooks/post-merge.cmd` untuk Windows).

### Variabel environment

Script sinkronisasi memakai konfigurasi MySQL berikut:

- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `3306`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: `''`)
- `DB_NAME` (default: `fids_monitoring`)

Jika Anda memakai XAMPP/MySQL lokal, biasanya tidak perlu mengubah nilai default.
