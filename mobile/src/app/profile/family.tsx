import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import { FlatList, View } from "react-native";
import { Button, Card, EmptyState, Loading, Txt } from "../../components/ui";
import { relationLabel } from "../../lib/booking";
import { useI18n } from "../../lib/i18n";
import { useFamily } from "../../lib/queries";
import { colors, space } from "../../lib/theme";

export default function FamilyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const family = useFamily();
  const members = family.data?.members ?? [];
  const max = family.data?.max ?? 10;

  if (family.isLoading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t("family") }} />
      <FlatList
        data={members}
        keyExtractor={(m) => m.memberId}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        ListHeaderComponent={<Txt color={colors.muted}>{t("familyHint")}</Txt>}
        ListEmptyComponent={<EmptyState icon="people-outline" title={t("addMember")} body={t("familyHint")} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: "/profile/member", params: { id: item.memberId } })} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyBold">{item.fullName || item.firstName}</Txt>
              <Txt variant="small" color={colors.muted}>
                {[relationLabel(t, item.relation), item.age != null ? `${item.age}${item.ageUnit && item.ageUnit !== "Y" ? item.ageUnit.toLowerCase() : ""}` : "", item.sex]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Card>
        )}
        ListFooterComponent={
          members.length < max ? (
            <Button label={t("addMember")} icon="person-add" variant="secondary" onPress={() => router.push("/profile/member")} style={{ marginTop: space.sm }} />
          ) : undefined
        }
      />
    </View>
  );
}
