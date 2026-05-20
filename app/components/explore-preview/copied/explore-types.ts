export type CardAppearanceVariant = "light" | "dark";

export interface MasonryCardAppearance {
    background?: CardBackground;
    media?: CardMedia;
}

export interface DefaultMasonryContent {
    contents: string;
}

export interface CustomMasonryContent {
    title: string;
    tag: string;
    introduction: string;
}

export type MasonryCardContent = string | DefaultMasonryContent | CustomMasonryContent;

export interface MasonryCard {
    id: string;
    type: "top" | "big" | "normal";
    content: MasonryCardContent;
    contentMode?: "default" | "custom";
    heightPC: number;
    media?: CardMedia;
    background?: CardBackground;
    appearance?: Partial<Record<CardAppearanceVariant, MasonryCardAppearance>>;
    canClose: boolean;
    actionsAlign?: "left" | "center" | "right";
    contentAlign?: "top" | "center" | "bottom";
    actions?: CardAction[];
    onClose?: () => void;
}

export interface CardMedia {
    url: string;
    type: "image" | "video";
    width: number;
    height: number;
}

export interface CardBackground {
    color: string;
    img?: string;
    border?: string;
    boxShadow?: string;
}

export interface CardAction {
    id: string;
    content: string;
    url: string;
}
