import { RuleNodeKind } from "./node-types";

export type RuleNodeMetadata = {
  nodeType: string;
  kind: RuleNodeKind;
  displayNameZh: string;
  descriptionZh: string;
  categoryZh: string;
  tagsZh: string[];
};

export function defineRuleNodeMetadata(metadata: RuleNodeMetadata): RuleNodeMetadata {
  const nodeType = metadata.nodeType.trim();
  if (!nodeType) {
    throw new Error("nodeType is required");
  }

  const displayNameZh = metadata.displayNameZh.trim();
  if (!displayNameZh) {
    throw new Error("displayNameZh is required");
  }

  const descriptionZh = metadata.descriptionZh.trim();
  if (!descriptionZh) {
    throw new Error("descriptionZh is required");
  }

  return {
    ...metadata,
    nodeType,
    displayNameZh,
    descriptionZh,
    categoryZh: metadata.categoryZh.trim(),
    tagsZh: Array.isArray(metadata.tagsZh) ? metadata.tagsZh.map((tag) => tag.trim()).filter(Boolean) : []
  };
}
