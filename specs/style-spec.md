Location: <style> tags within <head>
Purpose: All visual styling and responsive design
Style Sections:
A. Global Styles

CSS reset (margin, padding, box-sizing)
Font family: Arial, sans-serif
Color scheme: #FFFFFF (white text)
Full viewport height layout

B. Background & Theme

Gradient background: Deep indigo (#1a1a3e) → Purple (#2d1b4e) → Violet (#4a2c5e)
Overlay gradient with transparency: Simulates Finnish lake "Midnight Sun"

Top: Deep indigo (90% opacity)
Middle: Purple tones (60-70% opacity)
Bottom: Orange/brown transition (40-50% opacity)


Fixed positioning for background overlay

C. Header Styles

Centered text alignment
Padding: 120px top, 80px bottom
H1 styling:

Font size: Responsive (clamp 2rem to 4.5rem)
Letter spacing: 0.3em (wide kerning for sci-fi effect)
Text shadow: White glow effect


Bio text:

Max width: 800px
Font size: Responsive (1rem to 1.3rem)
Line height: 1.8
Letter spacing: 0.05em



D. CTA Button ("START TRIALS")

Shape: Pill-shaped (border-radius: 50px)
Padding: 20px vertical, 60px horizontal
Background: Semi-transparent white (15% opacity)
Border: 2px solid white
Letter spacing: 0.2em
Backdrop filter: Blur effect
Hover state:

Background: Nearly opaque white (95%)
Text color changes to dark indigo
White glow shadow (30px spread)
Slight upward translation (-2px)


Transition: All properties at 0.3s ease

E. Carousel Section

Container max-width: 600px (narrow design)
Overflow: Hidden (for slide effect)
Touch action: pan-y (vertical scrolling allowed)

F. Bias Cards

Dimensions:

Width: 100% of container
Min-height: 500px (tall cards)
Padding: 80px vertical, 50px horizontal


Layout: Flexbox (column direction, centered)
Background: Semi-transparent white (10% opacity)
Border: 2px solid white (30% opacity)
Border radius: 20px
Backdrop filter: Blur
Hover state:

Background opacity increases to 20%
Border opacity increases to 60%
White glow shadow (40px spread)



G. Bias Images

Dimensions: 200px × 200px circular
Border: 3px solid white (50% opacity)
Margin bottom: 30px
Object fit: Cover
Hover state (when card is hovered):

Border color: White (90% opacity)
Shadow: White glow (30px spread)
Transform: Scale 1.05 (5% larger)


Transition: 0.3s ease

H. Typography (Bias Cards)

Title:

Font size: Responsive (1.5rem to 2.5rem)
Letter spacing: 0.15em
Margin bottom: 30px
Center aligned


Content:

Font size: Responsive (1rem to 1.2rem)
Line height: 1.8
Letter spacing: 0.05em
Center aligned



I. Carousel Navigation

Layout: Flexbox (space-between)
Padding: 0 20px
Margin top: 40px
Arrow buttons:

Circular shape: 60px diameter
Background: Semi-transparent white (10%)
Border: 2px solid white
Font size: 2rem
Flexbox centered content
Hover state:

Background: Nearly opaque white (90%)
Text color: Dark indigo
White glow shadow
Scale: 1.1 (10% larger)




Indicator text:

Font size: 1.2rem
Letter spacing: 0.1em
Format: "X / 10"



J. Footer Styles

Text alignment: Center
Padding: 80px top, 40px bottom
Motto styling:

Font size: Responsive (1.5rem to 2.5rem)
Letter spacing: 0.2em
White glow text shadow


Contact link:

Pill shape (border-radius: 25px)
Padding: 15px × 30px
Color: White (70% opacity)
Border: 1px solid white (30% opacity)
Hover state:

Full white color
Full white border
Background: White (10% opacity)
White glow shadow





K. Modal (Account Creation)

Display: None (default), Flex (when active)
Position: Fixed fullscreen
Background: Black (80% opacity)
Z-index: 1000
Centered content (flexbox)
Modal content box:

Background: Purple gradient
Border: 2px solid white (30% opacity)
Border radius: 20px
Padding: 60px × 40px
Max width: 500px


Close button:

Position: Absolute (top-right)
No background
Font size: 2rem
Hover: Scale 1.2, white glow



L. Form Styling

Labels:

Block display
Letter spacing: 0.1em
Font size: 0.9rem


Input fields:

Full width
Padding: 15px
Background: White (10% opacity)
Border: 1px solid white (30% opacity)
Border radius: 10px
White text color
Focus state:

White border (full opacity)
Background: White (15% opacity)
White glow shadow




Submit button:

Full width
Padding: 18px
Pill shape (border-radius: 50px)
Border: 2px solid white
Letter spacing: 0.2em
Hover: Same as CTA button



M. Mobile Responsive (@media max-width: 768px)

Header padding reduced to 80px top
Bias cards:

Padding: 60px × 35px
Min-height: 450px


Bias images: 150px × 150px
Navigation buttons: 50px diameter
Modal padding: 40px × 30px
