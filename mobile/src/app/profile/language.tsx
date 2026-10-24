import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { LanguageOptions } from "../../components/LanguagePicker";
import { TopBar, Txt } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, space } from "../../lib/theme";

/** Me → Language: the same four big choices as the Home sheet. Saved to the account so WhatsApp reminders follow it. */
export default function LanguageScreen() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={t("language")} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Txt color={colors.muted}>{t("languageHint")}</Txt>
        <LanguageOptions onPicked={() => setTimeout(() => router.back(), 200)} />
      </ScrollView>
    </View>
  );
}
