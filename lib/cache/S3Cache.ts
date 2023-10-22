import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { CacheEngine } from "./CacheEngine";
import { getEnv } from "../helpers/env";

type ScalewayRegions = "fr-par";
export const S3CacheOptionsScaleway: Record<
  ScalewayRegions,
  Pick<S3CacheOptions, "endpoint" | "region">
> = {
  "fr-par": {
    region: "fr-par",
    endpoint: "https://s3.fr-par.scw.cloud",
  },
} as const;

export type S3CacheOptions = {
  bucket: string;
  region: string;
  endpoint?: string;
  cacheDir?: string;
};

/**
 * Initialize a S3 cache engine
 */
export class S3Cache extends CacheEngine {
  private cacheDir: string;
  private bucket: string;
  private s3: S3Client;

  /**
   * Initialize a S3 cache engine.
   *
   * S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be present in environment.
   *
   * Preconfiguration exists for Scaleway regions
   *
   * @example new S3Cache({ bucket: "audio-cache", ...S3CacheOptionsScaleway["fr-par"] })
   */
  constructor({
    bucket,
    region,
    endpoint,
    cacheDir = "cache",
  }: S3CacheOptions) {
    super();

    this.bucket = bucket;
    this.cacheDir = cacheDir;

    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: getEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY"),
      },
      endpoint,
      forcePathStyle: true,
    });
  }

  public async get(cacheKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.fullKey(cacheKey),
    });

    const response = await this.s3.send(command);

    const content = await response.Body?.transformToString();

    return content as string;
  }

  public async has(cacheKey: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: this.fullKey(cacheKey),
    });

    try {
      await this.s3.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async set(cacheKey: string, content: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Body: content,
      Key: this.fullKey(cacheKey),
    });

    await this.s3.send(command);
  }

  public async delete(cacheKey: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.fullKey(cacheKey),
    });

    await this.s3.send(command);
  }

  private fullKey(cacheKey: string) {
    return `${this.cacheDir}/${cacheKey}`;
  }
}
