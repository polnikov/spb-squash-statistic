import { NextResponse } from "next/server";
import { getPlayerAvatarImage } from "@/lib/db/player-avatar-db";

/**
 * Serve a player photo as bytes.
 *
 * Pages ship only the URL, so the image is fetched once and then cached: the URL
 * carries the row's updatedAt, so a new upload produces a new URL and the old one
 * can be kept forever.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const avatar = await getPlayerAvatarImage(rid);
  if (!avatar) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(avatar.image), {
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.image.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${avatar.updatedAt.getTime()}"`,
    },
  });
}
