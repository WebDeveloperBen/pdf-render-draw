import { test, expect } from "@playwright/test"

test.describe("Group Rotation E2E", () => {
  test("should rotate two fill shapes 45 degrees correctly", async ({ page }) => {
    // Setup console logging
    const logs: string[] = []
    const errors: string[] = []

    page.on("console", (msg) => {
      const text = msg.text()
      logs.push(text)
      // Log ALL console messages to see what's happening
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

    // To draw at PDF coords (100, 100), we need to account for:
    // - SVG box position on page: svgBox.x, svgBox.y
    // - SVG internal transform: svgTransform.translateX, svgTransform.translateY
    // Page coordinates = svgBox position - SVG translate + desired PDF coords

    const x1 = svgBox.x - svgTransform.translateX + 100
    const y1 = svgBox.y - svgTransform.translateY + 100
    await page.mouse.move(x1, y1)
    await page.mouse.down()
    await page.mouse.move(x1 + 50, y1 + 50, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    console.log("✅ Drew fill 1 at page coords:", { x: x1, y: y1 })

    const x2 = svgBox.x - svgTransform.translateX + 200
    const y2 = svgBox.y - svgTransform.translateY + 100
    await page.mouse.move(x2, y2)
    await page.mouse.down()
    await page.mouse.move(x2 + 50, y2 + 50, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    console.log("✅ Drew fill 2 at page coords:", { x: x2, y: y2 })

    // Debug: check what's actually in the DOM
    await page.screenshot({ path: "e2e/screenshots/after-drawing.png" })

    const svgContent = await page.evaluate(() => {
      const svg = document.querySelector("svg")
      return svg ? svg.innerHTML.substring(0, 5000) : "SVG not found"
    })
    console.log("📋 SVG content (first 5000 chars):", svgContent)

    // Check store state
    const storeAnnotations = await page.evaluate(() => {
      try {
        const annotationStore = useAnnotationStore()
        return annotationStore.annotations.map((ann: any) => ({
          id: ann.id,
          type: ann.type,
          x: ann.x,
          y: ann.y
        }))
      } catch (e) {
        return `Error: ${e.message}`
      }
    })
    console.log("📊 Store annotations:", storeAnnotations)

    // Verify fills were created - check for rect elements with data-annotation-id
    // Note: There are 2 rects per fill (fill-rect + fill-border), so expect 4 total
    const fillRects = page.locator('rect[data-annotation-id][fill="green"]')
    await expect(fillRects).toHaveCount(2, { timeout: 5000 })
    console.log("✅ Both fills rendered in DOM")

    // Get initial positions from DOM
    const initialPositions = await page.evaluate(() => {
      const fills = Array.from(document.querySelectorAll('rect.fill-rect[data-annotation-id]'))
      return fills.map((el) => ({
        id: el.getAttribute("data-annotation-id"),
        x: parseFloat(el.getAttribute("x") || "0"),
        y: parseFloat(el.getAttribute("y") || "0"),
        width: parseFloat(el.getAttribute("width") || "0"),
        height: parseFloat(el.getAttribute("height") || "0"),
        transform: el.getAttribute("transform") || ""
      }))
    })

    console.log("📍 Initial positions from DOM:", initialPositions)

    // Click the Select tool
    const selectButton = page.getByRole("button", { name: /select/i })
    await selectButton.click()
    await page.waitForTimeout(300)
    console.log("✅ Select tool active")

    // Select both fills by dragging a selection box around them
    // Drag from top-left of first fill to bottom-right of second fill
    const dragStartX = x1 - 10 // Start before first fill
    const dragStartY = y1 - 10
    const dragEndX = x2 + 60 // End after second fill
    const dragEndY = y2 + 60

    await page.mouse.move(dragStartX, dragStartY)
    await page.mouse.down()
    await page.mouse.move(dragEndX, dragEndY, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    console.log("✅ Dragged selection box around both fills")

    // Debug: Check which annotations have the 'selected' class
    const selectedAnnotations = await page.evaluate(() => {
      const baseAnnotations = Array.from(document.querySelectorAll(".base-annotation"))
      return baseAnnotations.map((el) => ({
        id: el.getAttribute("data-annotation-id"),
        hasSelectedClass: el.classList.contains("selected"),
        classes: Array.from(el.classList)
      }))
    })
    console.log("📊 Annotations with selected class:", selectedAnnotations)

    // Debug: Check if group-transform-handles exists in DOM
    const groupTransformHTML = await page.evaluate(() => {
      const handles = document.querySelector(".group-transform-handles")
      if (!handles) return "NOT FOUND"
      return handles.outerHTML.substring(0, 500)
    })
    console.log("🔍 Group transform handles HTML:", groupTransformHTML)

    // Verify group transform handles appeared
    const groupTransformHandles = page.locator(".group-transform-handles")
    await expect(groupTransformHandles).toBeVisible({ timeout: 3000 })
    console.log("✅ Group transform handles visible")

    // Find the rotation handle
    const rotationHandle = page.locator(".rotation-handle")
    await expect(rotationHandle).toBeVisible()

    const rotationHandleBox = await rotationHandle.boundingBox()
    if (!rotationHandleBox) throw new Error("Rotation handle not found")

    console.log("🎯 Rotation handle at:", {
      x: rotationHandleBox.x + rotationHandleBox.width / 2,
      y: rotationHandleBox.y + rotationHandleBox.height / 2
    })

    // Group center in SVG coords (from actual fills)
    const groupCenterSvgX = (initialPositions[0].x + initialPositions[0].width / 2 + initialPositions[1].x + initialPositions[1].width / 2) / 2
    const groupCenterSvgY = (initialPositions[0].y + initialPositions[0].height / 2 + initialPositions[1].y + initialPositions[1].height / 2) / 2

    // Map center to screen via CTM to avoid double-translates
    const { centerScreenX, centerScreenY } = await page.evaluate(([cx, cy]) => {
      const svg = document.querySelector("svg") as SVGSVGElement | null
      const ctm = svg?.getScreenCTM()
      if (svg && ctm) {
        const pt = svg.createSVGPoint()
        pt.x = cx
        pt.y = cy
        const screen = pt.matrixTransform(ctm)
        return { centerScreenX: screen.x, centerScreenY: screen.y }
      }
      return { centerScreenX: 0, centerScreenY: 0 }
    }, [groupCenterSvgX, groupCenterSvgY] as const)

    // Rotation handle radius: half height (25) + ROTATION_DISTANCE (30) = 55
    const radius = 55
    const targetAngle = -Math.PI / 4
    const targetX = centerScreenX + Math.cos(targetAngle) * radius
    const targetY = centerScreenY + Math.sin(targetAngle) * radius

    const handleCenterScreenX = rotationHandleBox.x + rotationHandleBox.width / 2
    const handleCenterScreenY = rotationHandleBox.y + rotationHandleBox.height / 2

    console.log("📐 Group center (SVG):", { x: groupCenterSvgX, y: groupCenterSvgY })
    console.log("📐 Group center (screen):", { x: centerScreenX, y: centerScreenY })
    console.log("🔄 Rotating handle from:", {
      x: handleCenterScreenX,
      y: handleCenterScreenY
    })
    console.log("   To:", { x: targetX, y: targetY })
    console.log("   Around center:", { x: centerScreenX, y: centerScreenY })

    // Perform the rotation drag
    await page.mouse.move(handleCenterScreenX, handleCenterScreenY)
    await page.mouse.down()
    await page.waitForTimeout(100)

    // Drag to target position
    await page.mouse.move(targetX, targetY, { steps: 10 })
    await page.waitForTimeout(200)

    // Release to commit rotation
    await page.mouse.up()
    await page.waitForTimeout(500)

    console.log("✅ Rotation drag completed")

    // Get final positions and transforms from DOM
    const finalPositions = await page.evaluate(() => {
      const fills = Array.from(document.querySelectorAll('rect.fill-rect[data-annotation-id]'))
      return fills.map((el) => {
        const id = el.getAttribute("data-annotation-id")
        const x = parseFloat(el.getAttribute("x") || "0")
        const y = parseFloat(el.getAttribute("y") || "0")
        const width = parseFloat(el.getAttribute("width") || "0")
        const height = parseFloat(el.getAttribute("height") || "0")
        const transform = el.getAttribute("transform") || ""

        // Parse rotation from transform
        let rotation = 0
        const rotateMatch = transform.match(/rotate\(([-\d.]+)/)
        if (rotateMatch) {
          rotation = parseFloat(rotateMatch[1])
        }

        return {
          id,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          width: Math.round(width * 100) / 100,
          height: Math.round(height * 100) / 100,
          rotation: Math.round(rotation * 100) / 100,
          transform
        }
      })
    })

    console.log("\n📊 Final positions from DOM:", finalPositions)

    // Calculate expected positions after 45° rotation
    // Use actual initial positions from DOM
    const fill1Initial = initialPositions[0]
    const fill2Initial = initialPositions[1]

    // Calculate group center from initial positions
    const groupCenterX = (fill1Initial.x + fill1Initial.width / 2 + fill2Initial.x + fill2Initial.width / 2) / 2
    const groupCenterY = (fill1Initial.y + fill1Initial.height / 2 + fill2Initial.y + fill2Initial.height / 2) / 2

    console.log("📐 Group center:", { x: groupCenterX, y: groupCenterY })

    const rotationDelta = Math.PI / 4 // 45 degrees
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)

    // Fill 1: calculate offset from group center, rotate, then get new position
    const fill1CenterX = fill1Initial.x + fill1Initial.width / 2
    const fill1CenterY = fill1Initial.y + fill1Initial.height / 2
    const dx1 = fill1CenterX - groupCenterX
    const dy1 = fill1CenterY - groupCenterY
    const newCenter1X = groupCenterX + dx1 * cos - dy1 * sin
    const newCenter1Y = groupCenterY + dx1 * sin + dy1 * cos
    const expectedX1 = Math.round((newCenter1X - fill1Initial.width / 2) * 100) / 100
    const expectedY1 = Math.round((newCenter1Y - fill1Initial.height / 2) * 100) / 100

    // Fill 2: same calculation
    const fill2CenterX = fill2Initial.x + fill2Initial.width / 2
    const fill2CenterY = fill2Initial.y + fill2Initial.height / 2
    const dx2 = fill2CenterX - groupCenterX
    const dy2 = fill2CenterY - groupCenterY
    const newCenter2X = groupCenterX + dx2 * cos - dy2 * sin
    const newCenter2Y = groupCenterY + dx2 * sin + dy2 * cos
    const expectedX2 = Math.round((newCenter2X - fill2Initial.width / 2) * 100) / 100
    const expectedY2 = Math.round((newCenter2Y - fill2Initial.height / 2) * 100) / 100

    const expectedRotationDeg = Math.round((rotationDelta * 180) / Math.PI * 100) / 100 // 45°

    console.log("\n✅ Expected state:")
    console.log("  Fill 1:", { x: expectedX1, y: expectedY1, rotation: expectedRotationDeg })
    console.log("  Fill 2:", { x: expectedX2, y: expectedY2, rotation: expectedRotationDeg })

    // Match fills by ID from initial positions
    const fill1Final = finalPositions.find((p: any) => p.id === initialPositions[0].id)
    const fill2Final = finalPositions.find((p: any) => p.id === initialPositions[1].id)

    console.log("\n🔍 Verification:")
    console.log("  Fill 1 X:", { expected: expectedX1, actual: fill1Final.x, diff: Math.abs(fill1Final.x - expectedX1) })
    console.log("  Fill 1 Y:", { expected: expectedY1, actual: fill1Final.y, diff: Math.abs(fill1Final.y - expectedY1) })
    console.log("  Fill 1 rotation:", {
      expected: expectedRotationDeg,
      actual: fill1Final.rotation,
      diff: Math.abs(fill1Final.rotation - expectedRotationDeg)
    })

    console.log("  Fill 2 X:", { expected: expectedX2, actual: fill2Final.x, diff: Math.abs(fill2Final.x - expectedX2) })
    console.log("  Fill 2 Y:", { expected: expectedY2, actual: fill2Final.y, diff: Math.abs(fill2Final.y - expectedY2) })
    console.log("  Fill 2 rotation:", {
      expected: expectedRotationDeg,
      actual: fill2Final.rotation,
      diff: Math.abs(fill2Final.rotation - expectedRotationDeg)
    })

    // Verify positions (tolerance of 2 pixels)
    expect(Math.abs(fill1Final.x - expectedX1)).toBeLessThan(2)
    expect(Math.abs(fill1Final.y - expectedY1)).toBeLessThan(2)
    expect(Math.abs(fill2Final.x - expectedX2)).toBeLessThan(2)
    expect(Math.abs(fill2Final.y - expectedY2)).toBeLessThan(2)

    // Verify rotations (tolerance of 1 degree)
    expect(Math.abs(fill1Final.rotation - expectedRotationDeg)).toBeLessThan(1)
    expect(Math.abs(fill2Final.rotation - expectedRotationDeg)).toBeLessThan(1)

    // Verify DOM elements also have correct transforms
    expect(finalPositions).toHaveLength(2)
    for (const pos of finalPositions) {
      // Each should have a rotation close to 45°
      expect(Math.abs(pos.rotation - expectedRotationDeg)).toBeLessThan(1)
    }

    if (errors.length > 0) {
      console.log("\n⚠️ Errors during test:", errors)
    }

    console.log("\n✅ Test passed!")
  })
})
