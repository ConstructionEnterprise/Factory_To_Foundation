-- CreateTable
CREATE TABLE "logistics_document" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "file_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,

    CONSTRAINT "logistics_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logistics_document_s3_key_key" ON "logistics_document"("s3_key");

-- CreateIndex
CREATE INDEX "logistics_document_dispatch_id_idx" ON "logistics_document"("dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_document_file_id_version_key" ON "logistics_document"("file_id", "version");

-- AddForeignKey
ALTER TABLE "logistics_document" ADD CONSTRAINT "logistics_document_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "logistics_dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_document" ADD CONSTRAINT "logistics_document_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_document" ADD CONSTRAINT "logistics_document_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
