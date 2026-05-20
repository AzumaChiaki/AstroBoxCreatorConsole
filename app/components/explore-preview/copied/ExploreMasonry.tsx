import type { CardAction, MasonryCard } from "./explore-types";
import styles from "./ExploreMasonry.module.css";
import { ArrowRightIcon } from "@phosphor-icons/react";
import BlurEffect from "react-progressive-blur";
import type { CSSProperties } from "react";

export default function ExploreMasonry({
  content,
  appearance: appearanceOverride = "dark",
}: {
  content: MasonryCard[];
  appearance?: "light" | "dark";
}) {
  const appearance = appearanceOverride;
  const primaryCardIndex = content.findIndex((card) => card.type === "top");
  const primaryCard =
    primaryCardIndex >= 0 ? content[primaryCardIndex] : undefined;
  const remainingCards =
    primaryCardIndex >= 0
      ? [
          ...content.slice(0, primaryCardIndex),
          ...content.slice(primaryCardIndex + 1),
        ]
      : content;
  const normalCardHeight =
    remainingCards.find((card) => card.type === "normal")?.heightPC ?? 130;
  const secondaryGridStyle = {
    "--masonry-row-height": `${normalCardHeight}px`,
  } as CSSProperties;

  return (
    <div className={styles.compFramework}>
      <div className={styles.masonryBase}>
        {primaryCard && (
          <PrimaryCard
            key={primaryCard.id}
            card={primaryCard}
            appearance={appearance}
          />
        )}

        {remainingCards.length > 0 && (
          <div className={styles.secondaryGrid} style={secondaryGridStyle}>
            {remainingCards.map((card) => (
              <PrimaryCard key={card.id} card={card} appearance={appearance} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PrimaryCardProps {
  card: MasonryCard;
  appearance: "light" | "dark";
}

export function PrimaryCard({ card, appearance }: PrimaryCardProps) {
  const variantConfig = card.appearance?.[appearance];
  const fallbackConfig =
    card.appearance?.[appearance === "dark" ? "light" : "dark"];
  const background =
    variantConfig?.background ?? card.background ?? fallbackConfig?.background;
  const media = variantConfig?.media ?? card.media ?? fallbackConfig?.media;
  const sizeClassName =
    card.type === "top"
      ? styles.primaryTopCard
      : card.type === "big"
        ? styles.secondaryBigCard
        : card.type === "normal"
          ? styles.secondaryNormalCard
          : "";
  const contentAlign = card.contentAlign ?? "top";
  const isBottomAligned = contentAlign === "bottom";
  const isCenterAligned = contentAlign === "center";
  const actions = card.actions ?? [];
  const hasActions = actions.length > 0;
  const actionsJustifyContent =
    card.actionsAlign === "center"
      ? "center"
      : card.actionsAlign === "right"
        ? "flex-end"
        : "flex-start";

  const coverImg = background?.img || media?.url;

  const isCover =
    (card.type === "big" || card.type === "normal") &&
    card.contentMode === "default" &&
    typeof card.content === "object" &&
    !!coverImg;

  if (isCover) {
    const customContent = card.content as {
      title: string;
      tag: string;
      introduction: string;
    };
    const targetUrl = actions[0]?.url;

    const handleCardClick = () => {
      if (!targetUrl) return;
      if (targetUrl.endsWith(".md")) {
        const path = targetUrl.startsWith("/") ? targetUrl.slice(1) : targetUrl;
        // router.push("/blog", {}, { path });
        console.log({ path });
      } else {
        // window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    };

    return (
      <div
        data-gravity-item="true"
        className={`${styles.primaryCard} ${sizeClassName}`}
        onClick={handleCardClick}
        style={{
          border: background?.border,
          height: "100%",
          position: "relative",
          overflow: "hidden",
          cursor: targetUrl ? "pointer" : "default",
        }}
      >
        <img
          src={coverImg}
          alt={customContent.title}
          loading="eager"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
          }}
        />
        {/* 文字区背景渐进式模糊 */}
        {card.type === "big" ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "50%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
                zIndex: 9,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "140px",
                zIndex: 9,
                pointerEvents: "none",
              }}
            >
              <BlurEffect
                position="bottom"
                intensity={80}
              />
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "66%",
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
                zIndex: 9,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "200px",
                zIndex: 9,
                pointerEvents: "none",
              }}
            >
              <BlurEffect
                position="left"
                intensity={80}
              />
            </div>
          </>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            ...(card.type === "big"
              ? { bottom: 0, justifyContent: "flex-end" }
              : { top: 0, justifyContent: "flex-start" }),
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span className="text-xs text-white/50 mb-px">
            {customContent.tag}
          </span>
          <h3 className="text-2xl font-bold text-white leading-tight m-0 mb-1">
            {customContent.title}
          </h3>
          <p className="text-xs text-white/75 m-0">
            {customContent.introduction}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-gravity-item="true"
      className={`${styles.primaryCard} ${sizeClassName}`}
      style={{
        ...(background?.img
          ? {
              backgroundImage: `url(${background.img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: background?.color }),
        border: background?.border,
        height: card.type === "top" ? `${card.heightPC}px` : "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {(isBottomAligned || isCenterAligned) && (
            <div style={{ flexGrow: 1 }} />
          )}
          {card.contentMode === "default" && typeof card.content === "object" ? (
            <div
              className={styles.cardText}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  opacity: 0.6,
                  fontWeight: 380,
                  lineHeight: "18px",
                }}
              >
                {(card.content as { tag: string }).tag}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 600,
                  lineHeight: "26px",
                  letterSpacing: "-0.4px",
                }}
              >
                {(card.content as { title: string }).title}
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  opacity: 0.6,
                  fontWeight: 380,
                  lineHeight: "18px",
                }}
              >
                {(card.content as { tag: string }).tag}
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  opacity: 0.75,
                  lineHeight: "18px",
                  fontWeight: 330,
                }}
              >
                {(card.content as { introduction: string }).introduction}
              </p>
            </div>
          ) : (
            <div
              className={styles.cardText}
              style={{ flexShrink: 0 }}
              dangerouslySetInnerHTML={{
                __html:
                  typeof card.content === "string"
                    ? card.content
                    : (card.content as { contents: string }).contents,
              }}
            />
          )}
          {!isBottomAligned && !isCenterAligned && (
            <div style={{ flexGrow: 1 }} />
          )}
          {hasActions && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: actionsJustifyContent,
                gap: "18px",
                flexShrink: 0,
                padding: "0 18px 18px",
                width: "100%",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {actions.map((action) => (
                <CardActionButton key={action.id} action={action} />
              ))}
            </div>
          )}
          {isCenterAligned && <div style={{ flexGrow: 1 }} />}
        </div>
        {media && media.type === "image" && (
          <div
            className={styles.cardMedia}
            style={{ flex: "1 1 0%", minWidth: 0, display: "flex" }}
          >
            <img
              src={media.url}
              style={{
                objectFit: "cover",
                objectPosition: "left center",
                width: "100%",
                height: "100%",
                display: "block",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CardActionButton({ action }: { action: CardAction }) {
  const isBlog = action.url.endsWith(".md");

  const handleClick = () => {
    if (isBlog) {
      const path = action.url.startsWith("/")
        ? action.url.slice(1)
        : action.url;
      console.log({ path });
    } else {
      //window.open(action.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer flex-row items-center bg-transparent p-0"
      style={{
        minWidth: 0,
        maxWidth: "100%",
        border: "none",
        outline: "none",
        appearance: "none",
      }}
    >
      <ArrowRightIcon
        size={18}
        weight="bold"
        style={{ color: "#0088FF" }}
      ></ArrowRightIcon>
      <p
        style={{
          marginLeft: 4,
          color: "#0088FF",
          fontWeight: 520,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {action.content}
      </p>
    </button>
  );
}
