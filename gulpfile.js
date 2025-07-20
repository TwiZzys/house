const {src, dest, watch, parallel, series} = require("gulp");
const scss = require("gulp-dart-sass");
const concat = require("gulp-concat");
const autoprefixer = require("gulp-autoprefixer");
const terser = require("gulp-terser");
const browserSync = require("browser-sync").create();
const imagemin = require("gulp-imagemin");
const cache = require("gulp-cache");
const plumber = require("gulp-plumber");
const del = require("del");
const fonter = require("gulp-fonter");
const ttf2woff2 = require("gulp-ttf2woff2");
const svgSprite = require("gulp-svg-sprite");
const cheerio = require("gulp-cheerio");
const replace = require("gulp-replace");
const gulpWebp = require("gulp-webp");
const webp = gulpWebp.default || gulpWebp;

// --- Заміна шляхів (працює з dist) ---
function fixPaths() {
    return src("dist/**/*.html") // працюємо в dist
        .pipe(
            replace(/(src|href|srcset)=["']([^"']+)["']/g, (match, attr, url) => {
                let fixedUrl = url.replace(/^src\//, "");
                if (!fixedUrl.match(/^(https?:)?\/\//) && !fixedUrl.startsWith("/") && !fixedUrl.startsWith("./")) {
                    fixedUrl = "./" + fixedUrl;
                }
                return `${attr}="${fixedUrl}"`;
            })
        )
        .pipe(dest("dist"));
}

// BrowserSync (для розробки)
function browser_sync() {
    browserSync.init({
        server: {baseDir: "app/"}, // лише app
        notify: false,
        port: 3000,
    });
}

// Styles
function styles() {
    return src("app/scss/main.scss", {sourcemaps: true})
        .pipe(plumber())
        .pipe(scss({outputStyle: "compressed"}).on("error", scss.logError))
        .pipe(concat("style.min.css"))
        .pipe(
            autoprefixer({
                overrideBrowserslist: ["last 10 versions"],
                grid: true,
                cascade: false,
            })
        )
        .pipe(dest("app/css", {sourcemaps: "."}))
        .pipe(browserSync.stream());
}

// Scripts
function scripts() {
    return src([
        "node_modules/smoothscroll-polyfill/dist/smoothscroll.js",
        "app/js/main.js"
    ], {sourcemaps: true})
        .pipe(plumber())
        .pipe(concat("main.min.js"))
        .pipe(terser())
        .pipe(dest("app/js", {sourcemaps: "."}))
        .pipe(browserSync.stream());
}

// Images optimization (тільки для build)
function images() {
    return src(["app/images/**/*.*", "!app/images/svg/**/*.svg"])
        .pipe(plumber())
        .pipe(
            cache(
                imagemin([
                    imagemin.gifsicle({interlaced: true}),
                    imagemin.mozjpeg({quality: 75, progressive: true}),
                    imagemin.optipng({optimizationLevel: 5}),
                    imagemin.svgo({
                        plugins: [{removeViewBox: false}, {cleanupIDs: false}],
                    }),
                ])
            )
        )
        .pipe(dest("dist/images"));
}

// Fonts
function otfToTtf() {
    return src("app/fonts/**/*.otf")
        .pipe(fonter({formats: ["ttf"]}))
        .pipe(dest("app/fonts/"));
}

function ttfToWoff() {
    return src("app/fonts/**/*.ttf")
        .pipe(fonter({formats: ["woff"]}))
        .pipe(dest("app/fonts/"))
        .pipe(src("app/fonts/**/*.ttf"))
        .pipe(ttf2woff2())
        .pipe(dest("app/fonts/"));
}

const fonts = series(otfToTtf, ttfToWoff);

// SVG Sprite
function cleanSprite() {
    return del("app/images/sprite.svg");
}

function svgSprites() {
    return src("app/images/svg/*.svg")
        .pipe(
            cheerio({
                run: ($) => {
                    $("[fill]").removeAttr("fill");
                    $("[stroke]").removeAttr("stroke");
                    $("[style]").removeAttr("style");
                },
                parserOptions: {xmlMode: true},
            })
        )
        .pipe(
            svgSprite({
                mode: {
                    symbol: {
                        sprite: "sprite.svg",
                        dest: ".",
                        example: false,
                    },
                },
            })
        )
        .pipe(dest("app/images"));
}

const svgSpritesReload = series(cleanSprite, svgSprites, (done) => {
    browserSync.reload();
    done();
});

// Favicon
function favicon() {
    return src("app/*.{ico,png,svg}").pipe(dest("dist"));
}

// WebP
function convertWebp() {
    return src("app/images/**/*.{jpg,png}").pipe(webp()).pipe(dest("app/images"));
}

function copyWebp() {
    return src("app/images/**/*.webp").pipe(dest("dist/images"));
}

// HTML WebP update + конвертація img у picture (тільки build)
function webpHtmlUpdate() {
    return src("app/**/*.html")
        .pipe(
            replace(/<img([^>]*?)src=(["'])([^"']+)\.(jpg|png)\2([^>]*?)\s*\/?>/gi, (match, p1, quote, p2, ext, p4) => {
                const webpPath = `${p2}.webp`;
                const imgPath = `${p2}.${ext}`;
                return `<picture><source srcset="${webpPath}" type="image/webp"><img${p1}src=${quote}${imgPath}${quote}${p4}></picture>`;
            })
        )
        .pipe(dest("dist"));
}

// Clean dist
function cleanDist() {
    return del("dist");
}

// Copy CSS, JS, fonts (без HTML)
function buildFilesWithoutHtml() {
    return src(["app/css/style.min.css", "app/js/main.min.js", "app/fonts/**/*.{woff,woff2}"], {base: "app"}).pipe(dest("dist"));
}

// Delete WebP on JPG/PNG removal
function cleanWebp(filePath) {
    const webpPath = filePath.replace(/\.(jpg|png)$/, ".webp");
    return del(webpPath);
}

// Watch (для розробки)
// Під час розробки НЕ запускаємо таски, що змінюють dist
function watching() {
    watch("app/scss/**/*.scss", styles);
    watch(["app/js/**/*.js", "!app/js/main.min.js"], scripts);

    const svgWatcher = watch("app/images/svg/*.svg");
    svgWatcher.on("add", svgSpritesReload);
    svgWatcher.on("change", svgSpritesReload);
    svgWatcher.on("unlink", svgSpritesReload);

    const imgWatcher = watch("app/images/**/*.{jpg,png}");
    imgWatcher.on(
        "add",
        series(convertWebp, copyWebp, (done) => {
            browserSync.reload();
            done();
        })
    );
    imgWatcher.on(
        "change",
        series(convertWebp, copyWebp, (done) => {
            browserSync.reload();
            done();
        })
    );
    imgWatcher.on("unlink", (filePath) => {
        cleanWebp(filePath).then(() => {
            browserSync.reload();
        });
    });

    const webpWatcher = watch("app/images/**/*.webp");
    webpWatcher.on("add", () => browserSync.reload());
    webpWatcher.on("unlink", () => browserSync.reload());

    // Для HTML під час розробки просто оновлюємо браузер, не змінюємо файли dist
    watch("app/**/*.html").on("change", () => {
        browserSync.reload();
    });

    watch("app/fonts/**/*.{otf,ttf}", fonts);
}

exports.styles = styles;
exports.scripts = scripts;
exports.browser_sync = browser_sync;
exports.watching = watching;
exports.images = images;
exports.cleanDist = cleanDist;
exports.fonts = fonts;
exports.svgSprites = svgSpritesReload;
exports.favicon = favicon;
exports.convertWebp = convertWebp;
exports.copyWebp = copyWebp;
exports.webpHtmlUpdate = webpHtmlUpdate;
exports.fixPaths = fixPaths;

// --- Збірка ---
exports.build = series(
    cleanDist,
    fonts,
    images,
    convertWebp,
    copyWebp,
    svgSpritesReload,
    buildFilesWithoutHtml, // Копіюємо CSS, JS, шрифти
    webpHtmlUpdate, // Обробляємо HTML з конвертацією <img> у <picture>
    fixPaths, // Фіксимо шляхи в dist
    favicon
);

// --- За замовчуванням (розробка) ---
exports.default = parallel(styles, scripts, browser_sync, watching, fonts, svgSpritesReload);
