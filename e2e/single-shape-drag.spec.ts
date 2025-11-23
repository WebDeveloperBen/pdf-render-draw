import { test, expect } from "@playwright/test"

test.describe("Single Shape Drag Sensitivity Bug", () => {
  test("should drag a single fill shape smoothly without jumping", async ({ page }) => {
    // Setup console logging
    const logs: string[] = []
    const errors: string[] = []

    page.on("console", (msg) => {
      const text = msg.text()
      logs.push(text)
      console.log(`[Browser ${msg.type()}]:`, text)
      if (msg.type() === "error") {
        errors.push(text)
      }
    })

    page.on("pageerror", (error) => {
      console.error("❌ Page error:", error.message)
      errors.push(error.message)
    })

    // Navigate to the app
    const response = await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    })

    if (!response || !response.ok()) {
      throw new Error(`Failed to load page: ${response?.status()} ${response?.statusText()}`)
    }

    console.log("✅ Page loaded")

    // Wait for the canvas to be ready
    await page.waitForSelector("svg", { timeout: 10000 })
    console.log("✅ SVG canvas ready")

    // Click the Fill tool button
    const fillButton = page.getByRole("button", { name: /fill/i })
    await fillButton.click()
    await page.waitForTimeout(300)
    console.log("✅ Fill tool selected")

    // Get the SVG element to calculate drawing positions
    const svg = page.locator("svg").first()
    const svgBox = await svg.boundingBox()
    if (!svgBox) throw new Error("SVG not found")

    console.log("📐 SVG bounds:", svgBox)

    // Get the SVG's actual transform to calculate correct coordinates
    const svgTransform = await page.evaluate(() => {
      const svg = document.querySelector("svg")
      const style = svg?.style.transform || ""
      // Parse translate(x, y) from transform
      const match = style.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
      if (match) {
        return {
          translateX: parseFloat(match[1]),
          translateY: parseFloat(match[2])
        }
      }
      return { translateX: 0, translateY: 0 }
    })

    console.log("📐 SVG transform:", svgTransform)

    // Draw a fill shape at PDF coords (200, 200) with 100x100 size
    const pdfX = 200
    const pdfY = 200
    const fillWidth = 100
    const fillHeight = 100

    const drawStartX = svgBox.x - svgTransform.translateX + pdfX
    const drawStartY = svgBox.y - svgTransform.translateY + pdfY
    await page.mouse.move(drawStartX, drawStartY)
    await page.mouse.down()
    await page.mouse.move(drawStartX + fillWidth, drawStartY + fillHeight, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    console.log("✅ Drew fill shape at PDF coords:", { x: pdfX, y: pdfY, width: fillWidth, height: fillHeight })

    // Verify fill was created
    const fillRect = page.locator('rect[data-annotation-id][fill="green"]')
    await expect(fillRect).toHaveCount(1, { timeout: 5000 })
    console.log("✅ Fill shape rendered in DOM")

    // Get initial position from DOM
    const initialPosition = await page.evaluate(() => {
      const fill = document.querySelector('rect.fill-rect[data-annotation-id]')
      if (!fill) return null
      return {
        id: fill.getAttribute("data-annotation-id"),
        x: parseFloat(fill.getAttribute("x") || "0"),
        y: parseFloat(fill.getAttribute("y") || "0"),
        width: parseFloat(fill.getAttribute("width") || "0"),
        height: parseFloat(fill.getAttribute("height") || "0")
      }
    })

    console.log("📍 Initial position from DOM:", initialPosition)
    if (!initialPosition) throw new Error("Fill shape not found in DOM")

    // Click the Select tool
    const selectButton = page.getByRole("button", { name: /select/i })
    await selectButton.click()
    await page.waitForTimeout(300)
    console.log("✅ Select tool active")

    // Click on the center of the fill shape to select it
    const fillCenterX = drawStartX + fillWidth / 2
    const fillCenterY = drawStartY + fillHeight / 2
    await page.mouse.click(fillCenterX, fillCenterY)
    await page.waitForTimeout(300)
    console.log("✅ Clicked fill shape to select it")

    // Verify selection
    const selectedAnnotation = await page.evaluate(() => {
      const fill = document.querySelector('rect.fill-rect[data-annotation-id]')
      const parent = fill?.closest(".base-annotation")
      return {
        hasSelectedClass: parent?.classList.contains("selected"),
        id: fill?.getAttribute("data-annotation-id")
      }
    })
    console.log("📊 Selected annotation:", selectedAnnotation)

    // Verify transform handles appeared
    const transformHandles = page.locator(".transform-handles")
    await expect(transformHandles).toBeVisible({ timeout: 3000 })
    console.log("✅ Transform handles visible")

    // Now drag the shape 50px to the right and 50px down
    // This is a relatively small movement that should be 1:1 with mouse movement
    const dragDeltaX = 50
    const dragDeltaY = 50

    console.log("🖱️  Starting drag from:", { x: fillCenterX, y: fillCenterY })
    console.log("   Moving by delta:", { x: dragDeltaX, y: dragDeltaY })

    // Perform the drag
    await page.mouse.move(fillCenterX, fillCenterY)
    await page.mouse.down()
    await page.waitForTimeout(100)

    // Drag to new position (50px right, 50px down in screen space)
    const targetX = fillCenterX + dragDeltaX
    const targetY = fillCenterY + dragDeltaY
    await page.mouse.move(targetX, targetY, { steps: 10 })
    await page.waitForTimeout(200)

    // Release to commit the drag
    await page.mouse.up()
    await page.waitForTimeout(500)

    console.log("✅ Drag completed")

    // Get final position from DOM
    const finalPosition = await page.evaluate(() => {
      const fill = document.querySelector('rect.fill-rect[data-annotation-id]')
      if (!fill) return null
      return {
        id: fill.getAttribute("data-annotation-id"),
        x: parseFloat(fill.getAttribute("x") || "0"),
        y: parseFloat(fill.getAttribute("y") || "0"),
        width: parseFloat(fill.getAttribute("width") || "0"),
        height: parseFloat(fill.getAttribute("height") || "0")
      }
    })

    console.log("\n📊 Final position from DOM:", finalPosition)
    if (!finalPosition) throw new Error("Fill shape not found after drag")

    // Calculate actual movement in PDF coordinates
    const actualDeltaX = finalPosition.x - initialPosition.x
    const actualDeltaY = finalPosition.y - initialPosition.y

    console.log("\n📏 Movement analysis:")
    console.log("  Expected delta (PDF coords):", { x: dragDeltaX, y: dragDeltaY })
    console.log("  Actual delta (PDF coords):", { x: actualDeltaX, y: actualDeltaY })
    console.log("  Difference:", {
      x: Math.abs(actualDeltaX - dragDeltaX),
      y: Math.abs(actualDeltaY - dragDeltaY)
    })

    // The bug we're testing for: the shape moves WAY more than expected
    // If the drag is "too sensitive", actualDelta will be much larger than expected
    // For example, dragging 50px might move the shape 500px or more

    // Reasonable tolerance: the shape should move approximately 1:1 with the mouse
    // Allow up to 10px deviation (to account for rounding, transforms, etc.)
    const tolerance = 10

    console.log("\n🔍 Verification (tolerance: ±" + tolerance + "px):")
    console.log("  X movement within tolerance:", Math.abs(actualDeltaX - dragDeltaX) <= tolerance)
    console.log("  Y movement within tolerance:", Math.abs(actualDeltaY - dragDeltaY) <= tolerance)

    // Assert that the movement is reasonably close to expected (1:1 with mouse)
    // If this fails, it indicates the drag sensitivity bug
    expect(Math.abs(actualDeltaX - dragDeltaX)).toBeLessThan(tolerance)
    expect(Math.abs(actualDeltaY - dragDeltaY)).toBeLessThan(tolerance)

    // Also verify the shape didn't jump off-screen
    // Shape should still be within a reasonable distance from its starting position
    const maxReasonableMovement = 200 // If it moved more than 200px from a 50px drag, something is wrong
    expect(Math.abs(actualDeltaX)).toBeLessThan(maxReasonableMovement)
    expect(Math.abs(actualDeltaY)).toBeLessThan(maxReasonableMovement)

    if (errors.length > 0) {
      console.log("\n⚠️ Errors during test:", errors)
    }

    console.log("\n✅ Test completed!")
  })
})
