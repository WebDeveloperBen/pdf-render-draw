# Camera Integration

## Overview

Enable users to capture photos directly within the native app to attach as evidence, reference material, or documentation for projects and quotes. Essential for field workers who need to document job sites, existing conditions, measurements, or completed work.

## Use Cases

### Construction & Trades
- **Before/After**: Document conditions before and after work
- **Progress Photos**: Track project milestones
- **Issue Documentation**: Capture problems for quotes/repairs
- **Material Verification**: Photo receipts and materials on site
- **Measurement Reference**: Photos alongside annotation measurements

### Professional Services
- **Site Surveys**: Document existing conditions
- **Inspection Reports**: Attach photos to PDF reports
- **Client Communication**: Visual proof for quotes
- **Compliance Documentation**: Safety/regulatory evidence

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Native App (Tauri)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Vue Component                        │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │  useNativeCamera()                                │ │   │
│  │  │  - capturePhoto()                                 │ │   │
│  │  │  - selectFromGallery()                            │ │   │
│  │  │  - getPhotoMetadata()                             │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ Tauri Commands                   │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Rust Backend                         │   │
│  │  - tauri-plugin-camera                                  │   │
│  │  - Image processing                                     │   │
│  │  - EXIF extraction                                      │   │
│  │  - File compression                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Cloud Storage     │
                    │   (S3/Azure Blob)   │
                    └─────────────────────┘
```

## Data Model

### Photo Attachment

```typescript
// types/photo.ts
interface PhotoAttachment {
  id: string
  projectId: string
  documentId?: string  // Linked PDF document
  annotationId?: string  // Linked to specific annotation

  // File data
  filename: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/heic'
  size: number
  url: string
  thumbnailUrl: string

  // Metadata
  metadata: PhotoMetadata

  // Organization
  category?: PhotoCategory
  tags: string[]
  notes?: string

  // Timestamps
  capturedAt: Date
  uploadedAt: Date
  createdBy: string
}

interface PhotoMetadata {
  // Camera info
  device?: string
  make?: string
  model?: string

  // Capture settings
  width: number
  height: number
  orientation?: number
  flash?: boolean
  focalLength?: number
  aperture?: number
  iso?: number
  exposureTime?: string

  // Location (if permitted)
  location?: {
    latitude: number
    longitude: number
    altitude?: number
    accuracy?: number
    address?: string  // Reverse geocoded
  }

  // Date/time
  dateTimeOriginal?: Date
  dateTimeDigitized?: Date

  // AI-extracted (see ai-image-analysis.md)
  aiAnalysis?: {
    description?: string
    labels?: string[]
    text?: string[]
    objects?: DetectedObject[]
  }
}

type PhotoCategory =
  | 'before'
  | 'after'
  | 'progress'
  | 'issue'
  | 'material'
  | 'measurement'
  | 'receipt'
  | 'site'
  | 'other'
```

### Database Schema

```typescript
// server/database/schema/photos.ts
import { pgTable, text, timestamp, integer, jsonb, real } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { documents } from './documents'
import { users } from './auth'

export const photoAttachments = pgTable('photo_attachments', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  documentId: text('document_id')
    .references(() => documents.id, { onDelete: 'set null' }),
  annotationId: text('annotation_id'),

  // File info
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),

  // Dimensions
  width: integer('width').notNull(),
  height: integer('height').notNull(),

  // Location
  latitude: real('latitude'),
  longitude: real('longitude'),
  altitude: real('altitude'),
  locationAccuracy: real('location_accuracy'),
  address: text('address'),

  // Organization
  category: text('category'),
  tags: jsonb('tags').$type<string[]>().default([]),
  notes: text('notes'),

  // Metadata
  metadata: jsonb('metadata').$type<PhotoMetadata>(),

  // Timestamps
  capturedAt: timestamp('captured_at'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id)
})
```

## Implementation

### Tauri Camera Plugin Setup

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-camera = "2"
image = "0.24"
kamadak-exif = "0.5"
```

```json
// src-tauri/capabilities/mobile.json
{
  "permissions": [
    "camera:default",
    "camera:allow-get-photo",
    "camera:allow-pick-images",
    "fs:default",
    "geolocation:default"
  ]
}
```

### Rust Commands

```rust
// src-tauri/src/commands/camera.rs
use tauri_plugin_camera::{Camera, CameraPermissionState, ImageOptions, ImageSource};
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct CapturedPhoto {
    pub path: String,
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub metadata: PhotoMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct PhotoMetadata {
    pub device: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub date_time_original: Option<String>,
    pub orientation: Option<u32>,
}

#[derive(Deserialize)]
pub struct CaptureOptions {
    pub quality: Option<u8>,          // 1-100
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub include_location: Option<bool>,
    pub source: Option<String>,       // "camera" | "gallery"
}

#[tauri::command]
pub async fn capture_photo(
    app: tauri::AppHandle,
    options: CaptureOptions,
) -> Result<CapturedPhoto, String> {
    let camera = app.camera();

    // Check permission
    let permission = camera.check_permissions().await.map_err(|e| e.to_string())?;
    if permission.camera != CameraPermissionState::Granted {
        camera.request_permissions().await.map_err(|e| e.to_string())?;
    }

    let source = match options.source.as_deref() {
        Some("gallery") => ImageSource::Photos,
        _ => ImageSource::Camera,
    };

    let image_options = ImageOptions {
        quality: options.quality.unwrap_or(80),
        allow_editing: false,
        source,
        ..Default::default()
    };

    let image = camera.get_photo(image_options).await.map_err(|e| e.to_string())?;

    // Read image data
    let data = std::fs::read(&image.path).map_err(|e| e.to_string())?;

    // Process image
    let img = image::load_from_memory(&data).map_err(|e| e.to_string())?;
    let (width, height) = img.dimensions();

    // Resize if needed
    let processed = if let (Some(max_w), Some(max_h)) = (options.max_width, options.max_height) {
        if width > max_w || height > max_h {
            img.resize(max_w, max_h, image::imageops::FilterType::Lanczos3)
        } else {
            img
        }
    } else {
        img
    };

    // Extract EXIF metadata
    let metadata = extract_exif_metadata(&data);

    // Compress output
    let mut output = Vec::new();
    processed
        .write_to(&mut Cursor::new(&mut output), ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(CapturedPhoto {
        path: image.path,
        data: output,
        width: processed.width(),
        height: processed.height(),
        metadata,
    })
}

fn extract_exif_metadata(data: &[u8]) -> PhotoMetadata {
    let mut metadata = PhotoMetadata {
        device: None,
        make: None,
        model: None,
        latitude: None,
        longitude: None,
        date_time_original: None,
        orientation: None,
    };

    if let Ok(exif) = exif::Reader::new().read_from_container(&mut Cursor::new(data)) {
        if let Some(field) = exif.get_field(exif::Tag::Make, exif::In::PRIMARY) {
            metadata.make = Some(field.display_value().to_string());
        }
        if let Some(field) = exif.get_field(exif::Tag::Model, exif::In::PRIMARY) {
            metadata.model = Some(field.display_value().to_string());
        }
        if let Some(field) = exif.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY) {
            metadata.date_time_original = Some(field.display_value().to_string());
        }
        if let Some(field) = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY) {
            if let exif::Value::Short(ref v) = field.value {
                metadata.orientation = v.first().map(|&x| x as u32);
            }
        }

        // GPS coordinates
        metadata.latitude = extract_gps_coord(&exif, exif::Tag::GPSLatitude, exif::Tag::GPSLatitudeRef);
        metadata.longitude = extract_gps_coord(&exif, exif::Tag::GPSLongitude, exif::Tag::GPSLongitudeRef);
    }

    // Get device info
    #[cfg(target_os = "ios")]
    {
        metadata.device = Some("iOS".to_string());
    }
    #[cfg(target_os = "android")]
    {
        metadata.device = Some("Android".to_string());
    }

    metadata
}

fn extract_gps_coord(exif: &exif::Exif, coord_tag: exif::Tag, ref_tag: exif::Tag) -> Option<f64> {
    let coord = exif.get_field(coord_tag, exif::In::PRIMARY)?;
    let coord_ref = exif.get_field(ref_tag, exif::In::PRIMARY)?;

    if let exif::Value::Rational(ref v) = coord.value {
        if v.len() >= 3 {
            let degrees = v[0].to_f64();
            let minutes = v[1].to_f64();
            let seconds = v[2].to_f64();

            let mut decimal = degrees + minutes / 60.0 + seconds / 3600.0;

            let ref_str = coord_ref.display_value().to_string();
            if ref_str == "S" || ref_str == "W" {
                decimal = -decimal;
            }

            return Some(decimal);
        }
    }
    None
}

#[tauri::command]
pub async fn check_camera_permission(app: tauri::AppHandle) -> Result<bool, String> {
    let camera = app.camera();
    let permission = camera.check_permissions().await.map_err(|e| e.to_string())?;
    Ok(permission.camera == CameraPermissionState::Granted)
}

#[tauri::command]
pub async fn request_camera_permission(app: tauri::AppHandle) -> Result<bool, String> {
    let camera = app.camera();
    let permission = camera.request_permissions().await.map_err(|e| e.to_string())?;
    Ok(permission.camera == CameraPermissionState::Granted)
}
```

### Vue Composable

```typescript
// composables/useNativeCamera.ts
import { useTauri } from './useTauri'

interface CaptureOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  includeLocation?: boolean
  source?: 'camera' | 'gallery'
}

interface CapturedPhoto {
  path: string
  data: number[]  // Uint8Array from Rust
  width: number
  height: number
  metadata: {
    device?: string
    make?: string
    model?: string
    latitude?: number
    longitude?: number
    dateTimeOriginal?: string
    orientation?: number
  }
}

export function useNativeCamera() {
  const { isTauri, invoke } = useTauri()

  const hasPermission = ref(false)
  const isCapturing = ref(false)

  // Check if camera is available
  const isAvailable = computed(() => isTauri.value)

  async function checkPermission(): Promise<boolean> {
    if (!isTauri.value) return false

    try {
      hasPermission.value = await invoke<boolean>('check_camera_permission')
      return hasPermission.value
    } catch {
      return false
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!isTauri.value) return false

    try {
      hasPermission.value = await invoke<boolean>('request_camera_permission')
      return hasPermission.value
    } catch {
      return false
    }
  }

  async function capturePhoto(options: CaptureOptions = {}): Promise<CapturedPhoto | null> {
    if (!isTauri.value) {
      // Fallback to file input for web
      return capturePhotoWeb()
    }

    // Ensure permission
    if (!hasPermission.value) {
      const granted = await requestPermission()
      if (!granted) {
        throw new Error('Camera permission denied')
      }
    }

    isCapturing.value = true

    try {
      const photo = await invoke<CapturedPhoto>('capture_photo', {
        options: {
          quality: options.quality ?? 80,
          max_width: options.maxWidth ?? 2048,
          max_height: options.maxHeight ?? 2048,
          include_location: options.includeLocation ?? true,
          source: options.source ?? 'camera'
        }
      })

      return photo
    } finally {
      isCapturing.value = false
    }
  }

  async function selectFromGallery(options: CaptureOptions = {}): Promise<CapturedPhoto | null> {
    return capturePhoto({ ...options, source: 'gallery' })
  }

  // Web fallback using file input
  async function capturePhotoWeb(): Promise<CapturedPhoto | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          resolve(null)
          return
        }

        const arrayBuffer = await file.arrayBuffer()
        const data = Array.from(new Uint8Array(arrayBuffer))

        // Get dimensions
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve({
            path: file.name,
            data,
            width: img.width,
            height: img.height,
            metadata: {}
          })
        }

        img.src = url
      }

      input.click()
    })
  }

  // Convert captured photo to blob for upload
  function photoToBlob(photo: CapturedPhoto): Blob {
    const uint8Array = new Uint8Array(photo.data)
    return new Blob([uint8Array], { type: 'image/jpeg' })
  }

  // Convert to data URL for preview
  function photoToDataUrl(photo: CapturedPhoto): string {
    const uint8Array = new Uint8Array(photo.data)
    const base64 = btoa(String.fromCharCode(...uint8Array))
    return `data:image/jpeg;base64,${base64}`
  }

  // Initialize on mount
  onMounted(() => {
    checkPermission()
  })

  return {
    isAvailable,
    hasPermission,
    isCapturing,
    checkPermission,
    requestPermission,
    capturePhoto,
    selectFromGallery,
    photoToBlob,
    photoToDataUrl
  }
}
```

## UI Components

### Photo Capture Button

```vue
<!-- components/photo/CaptureButton.vue -->
<script setup lang="ts">
const props = defineProps<{
  projectId: string
  documentId?: string
  annotationId?: string
}>()

const emit = defineEmits<{
  captured: [photo: PhotoAttachment]
}>()

const { capturePhoto, selectFromGallery, isCapturing, isAvailable, photoToBlob } = useNativeCamera()
const { nativeFetch } = useNativeFetch()

const showOptions = ref(false)
const uploading = ref(false)

async function handleCapture(source: 'camera' | 'gallery') {
  showOptions.value = false

  try {
    const photo = source === 'camera'
      ? await capturePhoto({ includeLocation: true })
      : await selectFromGallery()

    if (!photo) return

    uploading.value = true

    // Upload photo
    const formData = new FormData()
    formData.append('file', photoToBlob(photo), 'photo.jpg')
    formData.append('projectId', props.projectId)
    if (props.documentId) formData.append('documentId', props.documentId)
    if (props.annotationId) formData.append('annotationId', props.annotationId)
    formData.append('metadata', JSON.stringify(photo.metadata))

    const attachment = await nativeFetch<PhotoAttachment>('/api/photos/upload', {
      method: 'POST',
      body: formData
    })

    emit('captured', attachment)
    toast.success('Photo uploaded')
  } catch (error) {
    toast.error('Failed to capture photo')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="capture-button">
    <DropdownMenu v-model:open="showOptions">
      <DropdownMenuTrigger as-child>
        <Button
          :disabled="!isAvailable || isCapturing || uploading"
          :loading="isCapturing || uploading"
        >
          <Icon name="camera" class="mr-2" />
          Add Photo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem @click="handleCapture('camera')">
          <Icon name="camera" class="mr-2" />
          Take Photo
        </DropdownMenuItem>
        <DropdownMenuItem @click="handleCapture('gallery')">
          <Icon name="image" class="mr-2" />
          Choose from Gallery
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
```

### Photo Gallery

```vue
<!-- components/photo/PhotoGallery.vue -->
<script setup lang="ts">
const props = defineProps<{
  projectId: string
  documentId?: string
}>()

const { data: photos, refresh } = await useFetch<PhotoAttachment[]>('/api/photos', {
  query: {
    projectId: props.projectId,
    documentId: props.documentId
  }
})

const selectedPhoto = ref<PhotoAttachment | null>(null)

async function deletePhoto(id: string) {
  if (!confirm('Delete this photo?')) return

  await $fetch(`/api/photos/${id}`, { method: 'DELETE' })
  refresh()
  toast.success('Photo deleted')
}
</script>

<template>
  <div class="photo-gallery">
    <div class="gallery-header">
      <h3>Photos ({{ photos?.length ?? 0 }})</h3>
      <CaptureButton
        :project-id="projectId"
        :document-id="documentId"
        @captured="refresh()"
      />
    </div>

    <div v-if="photos?.length" class="gallery-grid">
      <div
        v-for="photo in photos"
        :key="photo.id"
        class="photo-item"
        @click="selectedPhoto = photo"
      >
        <img :src="photo.thumbnailUrl" :alt="photo.filename" />
        <div class="photo-overlay">
          <Badge v-if="photo.category">{{ photo.category }}</Badge>
          <span class="photo-date">
            {{ new Date(photo.capturedAt).toLocaleDateString() }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <Icon name="image" class="text-muted-foreground" size="48" />
      <p>No photos yet</p>
    </div>

    <!-- Photo Detail Dialog -->
    <Dialog v-model:open="!!selectedPhoto" @update:open="selectedPhoto = null">
      <DialogContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ selectedPhoto?.filename }}</DialogTitle>
        </DialogHeader>

        <div v-if="selectedPhoto" class="photo-detail">
          <img :src="selectedPhoto.url" :alt="selectedPhoto.filename" />

          <div class="photo-info">
            <!-- Category -->
            <Select v-model="selectedPhoto.category">
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="material">Material</SelectItem>
              </SelectContent>
            </Select>

            <!-- Metadata -->
            <div class="metadata">
              <p v-if="selectedPhoto.metadata.location">
                <Icon name="map-pin" />
                {{ selectedPhoto.metadata.location.address }}
              </p>
              <p v-if="selectedPhoto.capturedAt">
                <Icon name="calendar" />
                {{ new Date(selectedPhoto.capturedAt).toLocaleString() }}
              </p>
              <p v-if="selectedPhoto.metadata.device">
                <Icon name="smartphone" />
                {{ selectedPhoto.metadata.device }}
              </p>
            </div>

            <!-- Notes -->
            <Textarea
              v-model="selectedPhoto.notes"
              placeholder="Add notes..."
            />

            <!-- AI Analysis (if available) -->
            <div v-if="selectedPhoto.metadata.aiAnalysis" class="ai-analysis">
              <h4>AI Analysis</h4>
              <p>{{ selectedPhoto.metadata.aiAnalysis.description }}</p>
              <div class="tags">
                <Badge
                  v-for="label in selectedPhoto.metadata.aiAnalysis.labels"
                  :key="label"
                  variant="secondary"
                >
                  {{ label }}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="destructive" @click="deletePhoto(selectedPhoto!.id)">
            Delete
          </Button>
          <Button @click="selectedPhoto = null">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
```

## API Endpoints

### Photo Upload

```typescript
// server/api/photos/upload.post.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '~/server/utils/auth-helpers'
import { db, schema } from '~/server/utils/db'
import sharp from 'sharp'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const formData = await readMultipartFormData(event)

  const file = formData?.find(f => f.name === 'file')
  const projectId = formData?.find(f => f.name === 'projectId')?.data.toString()
  const documentId = formData?.find(f => f.name === 'documentId')?.data.toString()
  const annotationId = formData?.find(f => f.name === 'annotationId')?.data.toString()
  const metadataRaw = formData?.find(f => f.name === 'metadata')?.data.toString()

  if (!file || !projectId) {
    throw createError({ statusCode: 400, message: 'Missing file or projectId' })
  }

  const metadata = metadataRaw ? JSON.parse(metadataRaw) : {}

  // Generate unique filename
  const id = crypto.randomUUID()
  const ext = 'jpg'
  const filename = `${id}.${ext}`
  const key = `photos/${projectId}/${filename}`
  const thumbnailKey = `photos/${projectId}/thumb_${filename}`

  // Process image with sharp
  const image = sharp(file.data)
  const imageMetadata = await image.metadata()

  // Create thumbnail
  const thumbnail = await image
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()

  // Upload original
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: file.data,
    ContentType: 'image/jpeg'
  }))

  // Upload thumbnail
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: thumbnailKey,
    Body: thumbnail,
    ContentType: 'image/jpeg'
  }))

  const baseUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`

  // Save to database
  const [photo] = await db.insert(schema.photoAttachments).values({
    id,
    projectId,
    documentId: documentId || null,
    annotationId: annotationId || null,
    filename,
    mimeType: 'image/jpeg',
    size: file.data.length,
    url: `${baseUrl}/${key}`,
    thumbnailUrl: `${baseUrl}/${thumbnailKey}`,
    width: imageMetadata.width!,
    height: imageMetadata.height!,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    metadata,
    capturedAt: metadata.dateTimeOriginal ? new Date(metadata.dateTimeOriginal) : new Date(),
    createdBy: session.user.id
  }).returning()

  // Trigger AI analysis (async)
  await $fetch('/api/photos/analyze', {
    method: 'POST',
    body: { photoId: id }
  }).catch(() => {
    // Non-blocking, analysis will happen in background
  })

  return photo
})
```

### List Photos

```typescript
// server/api/photos/index.get.ts
import { requireAuth } from '~/server/utils/auth-helpers'
import { db, schema } from '~/server/utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)

  const conditions = []

  if (query.projectId) {
    conditions.push(eq(schema.photoAttachments.projectId, query.projectId as string))
  }

  if (query.documentId) {
    conditions.push(eq(schema.photoAttachments.documentId, query.documentId as string))
  }

  if (query.category) {
    conditions.push(eq(schema.photoAttachments.category, query.category as string))
  }

  const photos = await db
    .select()
    .from(schema.photoAttachments)
    .where(and(...conditions))
    .orderBy(schema.photoAttachments.capturedAt)

  return photos
})
```

## Acceptance Criteria

### Camera Capture
- [ ] Camera permission request works
- [ ] Photo capture from camera works
- [ ] Gallery selection works
- [ ] Image compression works
- [ ] EXIF metadata extracted

### Location
- [ ] GPS coordinates captured (with permission)
- [ ] Location reverse geocoded to address
- [ ] Location displayed on photo detail

### Upload & Storage
- [ ] Photos upload to cloud storage
- [ ] Thumbnails generated automatically
- [ ] Progress indicator during upload
- [ ] Offline queue for later upload

### Organization
- [ ] Photos linked to projects
- [ ] Photos linked to documents
- [ ] Photos linked to annotations
- [ ] Category assignment works
- [ ] Tags can be added
- [ ] Notes can be added

### Gallery
- [ ] Grid view displays thumbnails
- [ ] Photo detail view works
- [ ] Category filtering works
- [ ] Delete photo works
- [ ] Download photo works

### Web Fallback
- [ ] File input works on web
- [ ] Camera capture works on mobile web
- [ ] Consistent experience across platforms
