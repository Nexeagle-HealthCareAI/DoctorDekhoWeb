import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type View, type ViewStyle } from "react-native";

export type FieldRef = RefObject<ComponentRef<typeof View> | null>;

/**
 * A scrolling screen that keeps the focused text box above the keyboard.
 *
 * Android apps built with Expo now always draw edge-to-edge, so the window no longer shrinks when the keyboard
 * opens (the old `adjustResize` behaviour). Without this, a box in the lower half of the screen — the phone number
 * on sign-in, age on "About you" — sits under the keyboard and the patient can't see what they type.
 * Here the screen gets bottom padding the height of the keyboard on both platforms, and the focused box is
 * scrolled into view a moment after the keyboard has opened.
 */
type Ctx = { revealField: (field: FieldRef) => void };
const KeyboardCtx = createContext<Ctx>({ revealField: () => {} });

/** Call from a TextInput's onFocus with a ref to the box (or the input itself) to scroll it into view. */
export const useRevealField = () => useContext(KeyboardCtx).revealField;

export function KeyboardScreen({ children, contentContainerStyle, gapAboveField = 120 }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle>; gapAboveField?: number }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const pending = useRef<FieldRef | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const scrollTo = useCallback(
    (field: FieldRef) => {
      const node = field.current;
      const inner = scroll.current?.getInnerViewRef();
      if (!node || !inner) return;
      node.measureLayout(
        inner,
        (_x: number, y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - gapAboveField), animated: true }),
        () => {},
      );
    },
    [gapAboveField],
  );

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      setKeyboardUp(true);
      // The padding lands on the next frame; scroll after it so the box clears the keyboard.
      if (pending.current) setTimeout(() => pending.current && scrollTo(pending.current), 60);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollTo]);

  const value = useMemo<Ctx>(
    () => ({
      revealField: (field) => {
        pending.current = field;
        // Keyboard already open (moving from one box to the next): scroll now.
        if (keyboardUp) setTimeout(() => scrollTo(field), 60);
      },
    }),
    [keyboardUp, scrollTo],
  );

  return (
    <KeyboardCtx.Provider value={value}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scroll} contentContainerStyle={contentContainerStyle} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardCtx.Provider>
  );
}
