/**
 * FontPreloader - Explicitly forces the browser to load and decode all weights of Inter and JetBrains Mono
 * before starting the presentation to eliminate FOUT (Flash of Unstyled Text) and metric measurement errors.
 */
export async function preloadAllFonts() {
    if (typeof document === 'undefined' || !document.fonts) return;

    const fontDescriptors = [
        '300 1rem Inter',
        '400 1rem Inter',
        '500 1rem Inter',
        '600 1rem Inter',
        '700 1rem Inter',
        '800 1rem Inter',
        '800 4.5rem Inter',
        '400 1rem "JetBrains Mono"',
        '600 1rem "JetBrains Mono"',
        '700 1rem "JetBrains Mono"'
    ];

    try {
        await Promise.all(fontDescriptors.map(f => document.fonts.load(f)));
    } catch (err) {
        // Fallback gracefully if any single font descriptor is unavailable
    }

    await document.fonts.ready;
}
