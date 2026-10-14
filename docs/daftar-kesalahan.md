# Daftar jenis kesalahan

Setiap pilihan jawaban yang salah punya satu label kesalahan. Label ini muncul di tab **Data** (kolom "Jenis kesalahan") dan dihitung di tab **Topics** (kolom "Kesalahan tersering") serta tab **Tutor**.

Gunanya: kalau kesalahannya selalu sama, penyebabnya bisa dicari. Misalnya `order_ops` muncul terus, berarti cara mengerjakan berurutannya belum kuat, bukan hitungannya.

| Label | Arti sederhana |
|---|---|
| `sign_error` | Tanda minus atau plusnya salah |
| `order_ops` | Salah urutan pengerjaan |
| `bracket_ignored` | Tanda kurung tidak dikerjakan lebih dulu |
| `exponent_base_error` | Pangkat dihitung sebagai perkalian biasa, misalnya 3 kuadrat dianggap 3 x 2 |
| `sqrt_confusion` | Akar kuadrat tertukar dengan membagi dua atau mengkuadratkan |
| `forgot_root` | Lupa menarik akarnya, angkanya dipakai apa adanya |
| `table_neighbor` | Hasil tabel perkalian yang bersebelahan |
| `sum_error` | Dijumlah padahal seharusnya dikali |
| `sum_instead_of_product` | Rumus luas atau keliling dijumlah padahal seharusnya dikali |
| `subtract_instead` | Dikurangi padahal seharusnya dibagi atau dikali |
| `subtract_instead_divide` | Dikurangi padahal seharusnya dibagi |
| `off_by_one` | Selisih satu angka |
| `off_by_ten` | Selisih sepuluh angka |
| `place_value_error` | Nilai tempat salah, puluhan dan satuan tertukar |
| `digit_swap` | Angka-angkanya tertukar posisi |
| `digit_concat` | Angka disambung jadi bilangan baru, misalnya 3x dengan x=4 dibaca 34 |
| `decimal_shift` | Nol di belakang angka salah hitung |
| `decimal_place` | Letak koma salah |
| `fraction_add_wrong` | Pembilang dan penyebut dua-duanya dijumlah |
| `fraction_mul_wrong` | Pecahan dikali padahal seharusnya dijumlah |
| `fraction_flip` | Pembilang dan penyebut tertukar |
| `denominator_only` | Penyebutnya saja yang diubah |
| `simplify_one_side` | Hanya angka atas atau hanya angka bawah yang dibagi |
| `forgot_multiply` | Lupa mengalikan setelah membagi, baru satu bagian dihitung |
| `invert_fraction` | Pembagian dengan pembilang dan penyebutnya terbalik |
| `percent_off_by_one` | Nol pada persen kurang atau lebih satu |
| `numerator_as_percent` | Angka atas pecahan langsung dijadikan persen |
| `percent_as_value` | Angka persen dipakai sebagai jawaban akhir |
| `missing_percent_sign` | Nilainya benar tapi satuannya persen hilang |
| `not_rounded` | Tidak dibulatkan sama sekali |
| `round_up_always` | Selalu dibulatkan ke atas |
| `round_down_always` | Selalu dibulatkan ke bawah |
| `wrong_place` | Dibulatkan ke tempat yang salah, misalnya ke ratusan padahal ke puluhan |
| `estimation_error` | Taksirannya jauh dari hasil yang masuk akal |
| `exact_value` | Menulis hasil tepat padahal soalnya minta taksiran |
| `partial_rounding` | Hanya satu angka yang dibulatkan |
| `parity_error` | Genap dan ganjil tertukar |
| `factor_multiple_confusion` | Faktor dan kelipatan tertukar |
| `prime_rule_error` | Bilangan prima dan bukan prima tertukar |
| `one_is_not_prime` | Angka 1 dianggap prima |
| `negative_order_error` | Urutan bilangan negatif salah dibandingkan |
| `order_error` | Urutan dari kecil ke besar salah |
| `wrong_inverse_op` | Operasi kebalikannya salah dipakai |
| `no_change` | Angkanya dipakai apa adanya, tidak dihitung |
| `wrong_operation` | Operasi yang dipakai tidak sesuai soal |
| `ratio_add` | Perbandingan dijumlah padahal seharusnya dikali |
| `ratio_subtract` | Perbandingan dikurangi |
| `ratio_flip` | Perbandingan dibalik |
| `ratio_wrong_op` | Perbandingan dikali langsung tanpa mencari faktornya |
| `conversion_wrong` | Faktor konversi satuan salah |
| `substitution_error` | Angka dimasukkan tapi operasinya salah, misalnya dijumlah bukan dikali |
| `formula_swap` | Dua besaran pada rumus tertukar |
| `perimeter_confusion` | Rumus keliling dipakai untuk mencari luas |
| `area_perimeter_swap` | Luas dan keliling tertukar |
| `triangle_formula_confusion` | Rumus segitiga (dibagi 2) dipakai pada bangun lain |
| `forgot_factor_2` | Angka 2 pada rumus keliling terlupa |
| `forgot_half` | Pada rumus luas segitiga lupa dibagi 2 |
| `multiplied_instead_of_divided` | Dikali padahal seharusnya dibagi |
| `wrong_line_pick` | Soal cari kesalahan: baris yang benar dianggap salah |

Label terakhir, `wrong_line_pick`, artinya barisnya sudah benar tapi dianggap yang salah. Kalau ini sering muncul, berarti dia membaca pengerjaan orang lain dengan kurang teliti, bukan salah hitung.
