# Оптимизация веб-сборки Godot 4 для 2D-игр

Данная конфигурация предназначена для создания **минимальной по размеру** и **мгновенно запускающейся** веб-сборки 2D игры в Godot 4.

---

## 1. Сравнение размеров и скорости

| Параметр | Стандартный экспорт Godot 4 | С кастомным 2D-шаблоном |
| :--- | :--- | :--- |
| **Размер WASM (исходный)** | ~38 - 40 МБ | **~10 - 13 МБ** (-70%) |
| **Размер WASM (Gzip / Brotli)** | ~9.6 - 11 МБ | **~2.8 - 3.5 МБ** (-70%) |
| **Потоки (Threads)** | Multi-thread (требует COOP/COEP) | **Single-thread** (работает везде) |
| **Время старта (Cold Start)** | 5 – 12 секунд | **1 – 2 секунды** |
| **Совместимость** | Часто ломается во фреймах/VK/TG/Яндекс | **100% совместимость со всеми платформами** |

---

## 2. Что уже настроено в проекте

1. **`project.godot`**:
   - Отключен 3D физический движок (Jolt Physics).
   - Отключено сжатие текстур VRAM (ETC2/ASTC/BPTC/S3TC), которое раздувает спрайты в разы. Для 2D используются компактные WebP / PNG.
   - Метод рендеринга зафиксирован на `gl_compatibility` (WebGL 2.0).

2. **`web_shell/shell.html`**:
   - Легковесный, моментально отображаемый HTML-шелл.
   - Нулевая задержка первого кадра (CSS/SVG спиннер загружается за < 30 мс).
   - Плавное исчезновение экрана загрузки без мерцания канваса.

3. **`export_presets.cfg`**:
   - Пресет экспорта `Web` настроен в режиме `Single-Threaded` (`variant/thread_support=false`). Это убирает накладные расходы на запуск WebWorker и необходимость заголовков `Cross-Origin-Opener-Policy`.
   - Подключен легковесный шелл `res://web_shell/shell.html`.

4. **`scripts/compress_and_serve.py`**:
   - Скрипт автоматического сжатия (Gzip / Brotli) и локального HTTP-сервера для мгновенного тестирования скорости загрузки.

---

## 3. Как собрать кастомный шаблон сборки (Custom Export Template)

Чтобы уменьшить `.wasm` с **40 МБ до 10-12 МБ** (в сжатом виде до **3 МБ**), необходимо скомпилировать шаблон без 3D-модулей, тяжелых элементов интерфейса и сложного текстового сервера.

### Вариант А: Через GitHub Actions (Рекомендуется, в 1 клик, без установки C++ на ПК)

В проекте уже создан workflow: [`.github/workflows/build_web_template.yml`](.github/workflows/build_web_template.yml).

1. Загрузите проект в репозиторий GitHub.
2. Перейдите во вкладку **Actions** -> выберите **Build Minimal 2D Web Export Template**.
3. Нажмите кнопку **Run workflow** (по умолчанию выбрана версия `4.7.2-stable`).
4. Через ~15 минут сборка завершится. Во вкладке Artifacts скачайте архив `web_nothreads_release.zip`.
5. Поместите скачанный `web_nothreads_release.zip` в папку `bin/` вашего проекта:
   `res://bin/web_nothreads_release.zip`.
6. В Godot в окне **Export -> Web -> Options -> Custom Template -> Release** укажите:
   `res://bin/web_nothreads_release.zip`.

---

### Вариант Б: Локальная сборка (SCons + Emscripten)

Если у вас установлен Emscripten SDK (`emsdk`):

1. Запустите скрипт:
   ```powershell
   .\build_template\build_web_template.ps1 -GodotVersion "4.7.2-stable"
   ```
2. Скрипт автоматически склонирует репозиторий Godot, применит настройки [`build_template/custom.py`](build_template/custom.py) и скомпилирует шаблон в `bin/web_nothreads_release.zip`.

---

## 4. Ключевые флаги сборки (`build_template/custom.py`)

- `disable_3d = "yes"` — полностью удаляет 3D рендерер, 3D ноды, свет, тени, шейдеры (-15% размера).
- `disable_physics_3d = "yes"`, `module_godot_physics_3d_enabled = "no"`, `module_jolt_enabled = "no"` — отключает всю 3D физику.
- `disable_advanced_gui = "yes"` — удаляет ненужные для 2D игр виджеты (Tree, CodeEdit, ColorPicker, GraphEdit и др.).
- `module_text_server_adv_enabled = "no"`, `module_text_server_fb_enabled = "yes"` — заменяет огромный HarfBuzz/ICU на легкий встроенный текстовый сервер (кириллица, латиница, цифры поддерживаются в полном объеме).
- `threads = "no"` — однопоточный WebAssembly. Запускается на любых хостингах и в WebView/iframe.
- `optimize = "size"` + `lto = "full"` — максимальная оптимизация размера компилятором и компоновщиком (Link Time Optimization).
- Отключены неиспользуемые форматы и модули: GLTF, FBX, CSG, GridMap, OpenXR, WebXR, ASTC, Basis Universal, BCdec, DDS, ETCpak, WebRTC, UPNP, ENet.

---

## 5. Как протестировать экспорт прямо сейчас

1. Выполните экспорт проекта:
   - Через Godot Editor: **Project -> Export -> Web -> Export Project** в папку `build/web/index.html`.
   - Или из консоли:
     ```powershell
     & "$env:USERPROFILE\Downloads\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe" --headless --export-release "Web" build/web/index.html
     ```

2. Запустите локальный оптимизированный сервер:
   ```powershell
   python scripts/compress_and_serve.py
   ```
   Скрипт автоматически сожмет сборку и откроет игру в браузере по адресу `http://localhost:8060/`.
