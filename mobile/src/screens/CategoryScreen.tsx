/**
 * CIT-07 — what is wrong, by picture (FR-PUB.2, FR-PUB.3).
 *
 * - The six categories of FR-PUB.2, as a grid of tiles, each with a picture and a
 *   text label — never a dropdown, and meaning never carried by colour alone.
 * - Fully offline: the categories are bundled with the app (`GET /categories`, a
 *   path-named route under DG-43, only confirms the same six keys).
 * - Choosing one starts the report: a LOCAL_DRAFT with a client-generated
 *   identifier (FR-PUB.3). Coming back and choosing again changes that draft's
 *   category; it never starts a second draft.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type DraftRepository } from "../storage/drafts";
import { Body, Notice, Screen, Title } from "../ui";

/** FR-PUB.2, in its order; the server's PARAKH_CATEGORIES. */
export const CATEGORIES = ["water", "road", "drainage", "streetlight", "waste", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Placeholder pictures until the icon set exists; every one carries its text label. */
const PICTURES: Record<Category, string> = {
  water: "💧",
  road: "🛣️",
  drainage: "🌊",
  streetlight: "💡",
  waste: "🗑️",
  other: "❓",
};

type Props = {
  drafts: DraftRepository;
  /** A draft already started, whose category is being changed (from CIT-11). */
  draftId?: string;
  /** The draft the category belongs to; CIT-08 comes next. */
  onChosen: (draftId: string) => void;
};

export function CategoryScreen({ drafts, draftId: existing, onChosen }: Props) {
  const { t } = useTranslation();
  const draftId = useRef<string | null>(existing ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async (category: Category) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      let id = draftId.current;
      if (id === null || (await drafts.get(id))?.pipeline_state !== "LOCAL_DRAFT") {
        id = (await drafts.create()).client_submission_id; // FR-PUB.3: the identifier is made here
        draftId.current = id;
      }
      await drafts.update(id, { category });
      onChosen(id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="CIT-07">
      <Title>{t("category.title")}</Title>
      <Body>{t("category.intro")}</Body>
      <View style={styles.grid}>
        {CATEGORIES.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={t(`category.${category}`)}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void choose(category)}
            style={styles.tile}
          >
            <Text style={styles.picture} accessibilityElementsHidden importantForAccessibility="no">
              {PICTURES[category]}
            </Text>
            <Text style={styles.label}>{t(`category.${category}`)}</Text>
          </Pressable>
        ))}
      </View>
      {failed ? <Notice>{t("category.failed")}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 16, justifyContent: "center" },
  tile: {
    width: "44%",
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0b5d3b",
    borderRadius: 12,
    padding: 12,
  },
  picture: { fontSize: 40, marginBottom: 8 },
  label: { fontSize: 18, fontWeight: "600", color: "#1b1b1b", textAlign: "center" },
});
