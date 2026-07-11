/**
 * Canvas-based image compression utility.
 * Resizes images to a max dimension and re-encodes as JPEG/PNG.
 */

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8

/**
 * Compress an image File using canvas.
 * - Resizes so the longest edge is at most 1920px (keeps aspect ratio).
 * - Uses JPEG at 80% quality for photos; keeps PNG for images with transparency.
 * - If the compressed blob is larger than the original, returns the original File.
 *
 * @returns A Blob ready for upload.
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img

        // Scale down if exceeds max dimension
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height / width) * MAX_DIMENSION)
            width = MAX_DIMENSION
          } else {
            width = Math.round((width / height) * MAX_DIMENSION)
            height = MAX_DIMENSION
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // PNG preserves transparency; everything else → JPEG
        const isPng = file.type === 'image/png'
        const mime = isPng ? 'image/png' : 'image/jpeg'

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'))
              return
            }
            // If compressed is larger, use original
            if (blob.size >= file.size) {
              resolve(file)
            } else {
              resolve(blob)
            }
          },
          mime,
          isPng ? undefined : JPEG_QUALITY,
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}
