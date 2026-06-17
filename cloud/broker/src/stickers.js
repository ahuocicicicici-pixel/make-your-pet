export function stickerForDelivery(delivery) {
  const key = delivery?.key || "";
  const message = delivery?.message || "";

  if (key.startsWith("advance:")) return "assets/stickers_coco_handdrawn_v2/03_watching.png";
  if (key === "due") return "assets/stickers_coco_handdrawn_v2/02_due_now.png";
  if (key.startsWith("overdue:")) return "assets/stickers_coco_handdrawn_v2/06_not_yet.png";
  if (key.startsWith("daily:")) return "assets/stickers_coco_handdrawn_v2/07_guarding.png";
  if (/喝水|喝口水/.test(message)) return "assets/stickers_coco_handdrawn_v2/09_water.png";
  if (/早上好|上午/.test(message)) return "assets/stickers_coco_handdrawn_v2/04_morning.png";
  return "assets/stickers_coco_handdrawn_v2/01_recorded.png";
}
