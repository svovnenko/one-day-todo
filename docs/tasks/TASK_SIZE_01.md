# Task SIZE-01: drop ~4 MB of unused icon fonts (no visual change)

## Why
The last published update (`dist/` from `eas update`) ships **3.6 MB of JS** plus **5.0 MB of assets**. Almost all the assets are icon fonts:
- MaterialCommunityIcons 1.3 MB, FontAwesome6 Solid 0.4 MB, Ionicons 0.4 MB, MaterialIcons 0.35 MB, Fontisto 0.3 MB, FontAwesome5 and FontAwesome6 Brands and more: about **4 MB** from `@expo/vector-icons`;
- MaterialSymbols 0.9 MB (from `expo-router` → `expo-symbols`; **out of scope for this task**).

The app uses **exactly one** icon: `Ionicons "settings-outline"` in `src/components/Header.tsx`. The barrel import `import { Ionicons } from '@expo/vector-icons'` pulls in every icon family.

New rule in spec section 2 ("Icons (v8.2)"): icons are inline SVG components; never import the whole `@expo/vector-icons` package.

## Do
1. **Measure before:** run `npx expo export --platform ios --output-dir dist-before`, and note the JS bundle size and the total `assets/` size. Don't commit `dist-before/`; add it to `.gitignore` if needed.
2. **Create `src/components/icons/GearIcon.tsx`:** a `react-native-svg` component that reproduces the Ionicons `settings-outline` look (outline gear, rounded). It takes `size` (default 20) and `color` props, with no hard-coded colours (theme tokens are passed in). Use the Ionicons SVG path (MIT licensed) or draw an equivalent; keep the visual weight the same as now.
3. **`Header.tsx`:** replace `Ionicons` with `<GearIcon size={20} color={colors.muted} />`. Keep the 44×44 hit area and `accessibilityLabel="Settings"`.
4. **Remove the package:** `npm uninstall @expo/vector-icons`. Then make sure nothing else imports it (`grep -rn "vector-icons" app src`), and that it isn't a required peer of anything we use (`npm ls @expo/vector-icons`). If some Expo package still pulls it in transitively, that's fine as long as **our** code doesn't import it, so the fonts aren't bundled. Verify in step 6.
5. **Tests:** update any test or mock referencing `@expo/vector-icons`. Add a small render test for `GearIcon` (renders with the given size and colour).
6. **Measure after:** run `npx expo export --platform ios --output-dir dist-after`. **Expected:** none of the `@expo/vector-icons` `.ttf` files in the asset list, and the assets at about 1 MB (MaterialSymbols remains). Report before and after (JS, assets, total) in your final message. Delete `dist-before/` and `dist-after/`.

## Done when
- The gear looks the same in light and dark mode (compare with the previous screenshot).
- `npm run check` passes locally and in CI. Commit and push.
- `eas update --branch main --message "v8.2: drop unused icon fonts (-4 MB)" --environment production`. Remind the owner to open the new update in Expo Go.

## Re-test for the owner
1. The gear icon at the top right looks the same and opens Settings, in both light and dark mode.
2. Opening the new update in Expo Go is noticeably quicker on mobile data, since the download is about 4 MB smaller.
