import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function GET() {
  const result: Record<string, any> = {
    config: {
      endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? "❌ manquant",
      region: process.env.AWS_REGION ?? "❌ manquant",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ? "✅ présent" : "❌ manquant",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? "✅ présent" : "❌ manquant",
      bucket: process.env.NEON_STORAGE_BUCKET ?? "❌ manquant",
    }
  };

  try {
    const s3 = new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      region: process.env.AWS_REGION ?? "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });

    // Test liste
    try {
      const list = await s3.send(new ListObjectsV2Command({ Bucket: process.env.NEON_STORAGE_BUCKET!, MaxKeys: 5 }));
      result.list_test = { success: true, count: list.KeyCount ?? 0 };
    } catch (e: any) {
      result.list_test = { success: false, error: e.message };
    }

    // Test écriture
    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.NEON_STORAGE_BUCKET!,
        Key: "test/diag.txt",
        Body: Buffer.from("test"),
        ContentType: "text/plain",
      }));
      result.write_test = { success: true };
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.NEON_STORAGE_BUCKET!, Key: "test/diag.txt" }));
    } catch (e: any) {
      result.write_test = { success: false, error: e.message };
    }

  } catch (e: any) {
    result.error = e.message;
  }

  return NextResponse.json(result);
}
