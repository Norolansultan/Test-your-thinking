Location: <body> tag
Purpose: Page structure and content
Structure:
A. Header Section

<header> element
H1: "TEST YOUR DECISION SKILLS"
Bio paragraph (class: "bio")
CTA button (id: "startButton", text: "START TRIALS")

B. Carousel Section

<section> with class "carousel-section"
Container div (class: "carousel-container")
Wrapper div (id: "carouselWrapper", class: "carousel-wrapper")
Track div (id: "carouselTrack", class: "carousel-track")
10 bias cards, each containing:

SVG image (embedded as data URI)
H2 title (class: "bias-title")
Paragraph content (class: "bias-content")



C. Bias Card Content (10 Cards):

Confirmation Bias

Image: Face with checkmarks (seeking validation)
Text: "Seeking confirmation you are. Ignoring the errors of the AI you must not."


Automation Bias

Image: Robot/droid with red eye
Text: "Trusting the machine too much leads to the Dark Side. Verify, you must."


Anchoring Bias

Image: Target/crosshair with "1st" indicator
Text: "The first answer is not always the chosen one. Look deeper."


Availability Heuristic

Image: Memory/thought bubble with connection lines
Text: "Ease of memory does not equal truth. Rare are the failures, but deadly."


Dunning-Kruger Effect

Image: Overconfident face with crown
Text: "Confidence is not mastery. The AI sounds wise, but foolish it may be."


Recency Bias

Image: Clock pointing to "NOW"
Text: "Yesterday's success guarantees not today's victory. Judge every output anew."


Overconfidence Bias

Image: Arrogant expression with raised eyebrows
Text: "Arrogance blinds the Jedi. The AI's fluency is not fact."


Anthropomorphization

Image: Robot head with green eyes and antenna
Text: "A mind it has not. Patterns it mimics. Trust not the 'soul' of the machine."


Sunk Cost Fallacy

Image: Treasure chest (holding onto the past)
Text: "Let go of the bad prompt, you must. Start fresh, do not cling to the past."


Selection Bias

Image: Incomplete grid with X marks on missing data
Text: "Incomplete data leads to incomplete truth. See what is missing, you must."



D. Navigation Controls

<nav> element with class "carousel-nav"
Previous button (id: "prevButton", text: "<")
Indicator span (id: "indicator", text: "1 / 10")
Next button (id: "nextButton", text: ">")
