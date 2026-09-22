---

name: mobile-form-design
description: Design, review, redesign, and implement high-quality mobile forms. Use whenever creating or modifying forms, inputs, registration flows, profile forms, checkout, settings, data entry, multi-step forms, validation, selectors, date pickers, bottom sheets, keyboards, or form submission flows. Optimize for completion, clarity, touch ergonomics, accessibility, error prevention, and minimal cognitive load.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Mobile Form Design

You are an expert **Mobile UX Designer and Frontend Engineer specializing in form experiences**.

Your job is to make forms feel:

* Fast
* Simple
* Predictable
* Forgiving
* Comfortable on mobile
* Easy to scan
* Easy to correct
* Accessible
* Visually consistent
* Production-ready

A form is not a collection of inputs.

A form is a **conversation between the product and the user**.

The goal is not to collect the maximum amount of information.

The goal is to collect the necessary information with the minimum amount of friction.

---

# 1. Core Principle

Before creating a form, determine:

1. What is the user trying to accomplish?
2. What information is actually required?
3. Which fields can be inferred?
4. Which fields can be deferred?
5. Which fields can use smart defaults?
6. Which fields can use existing data?
7. Which fields can use device capabilities?
8. What is the user's expected completion time?
9. What happens after submission?

Never add a field simply because the backend supports it.

The backend model should not dictate the UX.

---

# 2. Minimize Fields

Every field has a cognitive and interaction cost.

For each field ask:

> Does the user need to provide this information right now?

If not, consider:

* Removing it
* Making it optional
* Moving it to a later step
* Inferring it
* Providing a default
* Loading it from the user's profile
* Requesting it only when needed

Prefer:

```text
Required fields
↓
Optional information later
```

over:

```text
Everything required immediately
```

---

# 3. One Column by Default

Mobile forms should normally use a single vertical column.

Preferred:

```text
Name
[____________]

Email
[____________]

Phone
[____________]

Password
[____________]

[ Continue ]
```

Avoid:

```text
First name     Last name
[________]     [________]
```

unless the fields are extremely short and the layout remains comfortable on the target device.

Single-column forms preserve:

* Reading order
* Focus order
* Keyboard behavior
* Vertical rhythm
* Accessibility

The form-design skill found online also recommends single-column layouts as the default because multi-column layouts disrupt reading flow.

---

# 4. Labels

Never rely exclusively on placeholders as labels.

Bad:

```text
[ Enter your email ]
```

Preferred:

```text
Email

[ you@example.com ]
```

The label should remain understandable after the user starts typing.

Placeholder text should provide an example or format hint, not replace the label.

---

# 5. Label + Input Relationship

Each input should clearly communicate:

* What information is expected
* Whether it is required
* What format is expected
* Whether the value is valid

Example:

```text
Phone number
Required

[ +52 656 123 4567 ]

We'll use this to contact you.
```

Do not overload the user with explanatory text.

Only explain what is necessary.

---

# 6. Required vs Optional

Do not mark every field with:

```text
*
```

without explaining what the symbol means.

Prefer one of:

### Required-by-default

Mark optional fields:

```text
Nickname (optional)
```

or:

### Optional-by-default

Clearly indicate required fields.

Choose the convention that results in less visual noise.

---

# 7. Input Type

Use the most appropriate input type.

Examples:

```text
Email
→ email keyboard

Phone
→ telephone keyboard

Number
→ numeric keyboard

Decimal
→ decimal keyboard

URL
→ URL keyboard

Password
→ password keyboard
```

The keyboard should match the user's expected input.

Do not make users manually switch keyboards unnecessarily.

---

# 8. Keyboard Is Part of the UX

Always consider the keyboard.

When a field receives focus:

* Keep it visible
* Scroll it into view
* Avoid covering the input
* Avoid covering the primary action
* Preserve context
* Respect safe areas

Test the lowest fields with the keyboard open.

A form that works without the keyboard but fails when typing is not finished.

---

# 9. Keyboard Navigation

Define the logical input order.

Example:

```text
First name
↓
Last name
↓
Email
↓
Phone
↓
Address
↓
Submit
```

Use:

* Next
* Continue
* Done

appropriately.

The keyboard's action should reflect the next expected user action.

---

# 10. Autofocus

Use autofocus carefully.

Good:

* Search
* Single-field flows
* Login when appropriate
* One obvious primary input

Avoid automatically opening the keyboard on:

* Long forms
* Screens where the user needs context first
* Forms with several possible starting fields

Opening the keyboard changes the viewport.

Do it only when it clearly helps.

---

# 11. Autofill

Support platform autofill whenever appropriate.

Examples:

* Name
* Email
* Phone
* Address
* Password
* One-time codes

Never make users type information that the platform can safely provide.

---

# 12. Input Formatting

Format information when formatting helps comprehension.

Examples:

```text
Phone
+52 656 123 4567

Currency
$1,250.00

Date
07/09/2026
```

However:

Do not make formatting interfere with editing.

The user must be able to:

* Edit
* Delete
* Replace
* Paste

without fighting the formatter.

---

# 13. Smart Defaults

Use sensible defaults.

Examples:

```text
Country → user's country
Currency → user's configured currency
Date → today
Quantity → 1
```

Defaults should be:

* Predictable
* Easy to change
* Based on reliable context

Never guess important information when an incorrect guess could cause harm.

---

# 14. Selectors

Do not use desktop-style dropdowns on mobile when a better interaction exists.

For a small set of choices:

```text
○ Option A
○ Option B
○ Option C
```

For a moderate list:

Use:

* Bottom sheet
* Action sheet
* Searchable selector

For large datasets:

Use:

```text
Search
+
Scrollable results
```

Do not force users to scroll through 100+ options.

---

# 15. Bottom Sheet Selectors

Bottom sheets are useful for mobile selection.

Use when:

* The list is short/moderate
* The user needs to make one choice
* The current screen should remain conceptually visible

The sheet should provide:

* Clear title
* Search when needed
* Selected state
* Easy dismissal
* Comfortable touch targets

---

# 16. Date Selection

Do not make users type dates manually when a picker is more appropriate.

Consider:

* Native date picker
* Calendar
* Wheel picker
* Bottom sheet
* Preset options

For common dates, presets can reduce effort:

```text
Today
Tomorrow
Next week
Custom
```

Use the interaction that best matches the domain.

---

# 17. Time Selection

Use appropriate time controls.

For scheduling:

```text
Morning
Afternoon
Evening
```

can sometimes be easier than exact time entry.

For precise appointments:

Use:

```text
Date
+
Time
```

with appropriate platform controls.

---

# 18. Searchable Selection

If the user must choose from a long list, add search.

Bad:

```text
Country
↓
200 countries
```

Better:

```text
Search countries

[ Mexico              ✓ ]
[ United States        ]
[ Canada               ]
```

Search should become available before the list becomes painful to navigate.

---

# 19. Validation Strategy

Validation should prevent errors without punishing the user.

Prefer:

```text
User enters value
↓
User moves forward
↓
Validate
```

rather than constantly interrupting typing.

Do not show:

```text
Email is invalid
```

while the user is still typing:

```text
carlos@
```

Wait until the input can reasonably be evaluated.

---

# 20. Inline Validation

Errors should appear close to the problematic field.

Bad:

```text
Something went wrong.
```

Preferred:

```text
Email

[ carlos@ ]

Please enter a valid email address.
```

The user should not have to search for the problem.

---

# 21. Error Messages

An error message should answer:

1. What is wrong?
2. How can I fix it?

Bad:

```text
Invalid input.
```

Better:

```text
Enter a valid email address.
```

Even better when appropriate:

```text
Use an email such as name@example.com.
```

Keep error messages concise.

---

# 22. Preserve User Input

When validation fails:

**Never unnecessarily clear the form.**

If the user entered:

```text
Name
Carlos

Email
incorrect-email
```

and email fails validation:

Keep:

```text
Carlos
```

The user should only need to fix the problematic field.

---

# 23. Error Summary

For long forms with multiple errors, provide an error summary.

Example:

```text
Please fix 3 items

• Email
• Phone number
• Date of birth
```

Tapping an error should focus or scroll to that field.

For short forms, inline errors are usually sufficient.

---

# 24. Submission

The submit action must communicate state.

States:

```text
Idle
↓
Submitting
↓
Success
```

or:

```text
Idle
↓
Submitting
↓
Error
```

During submission:

* Prevent accidental double submission
* Show progress
* Preserve entered values
* Keep the user informed

---

# 25. Submit Button

The primary action should be obvious.

Examples:

```text
Continue
Create account
Save changes
Add product
Confirm purchase
```

Avoid generic:

```text
Submit
```

when a more meaningful action is available.

The button should communicate the result.

---

# 26. Mobile CTA

For longer forms, consider a sticky bottom CTA.

Example:

```text
────────────────────
[ Save changes      ]
────────────────────
```

This can reduce scrolling back to the bottom.

However:

Do not make every form sticky.

Use it when:

* The form is long
* The action is important
* The user frequently needs to submit after scrolling

Respect:

* Safe areas
* Keyboard
* Bottom navigation
* Floating elements

---

# 27. Primary CTA Placement

For short forms:

```text
Last field
↓
small spacing
↓
Primary action
```

For long forms:

Consider:

```text
Sticky CTA
```

Do not put the primary action far away from the fields it submits.

---

# 28. Secondary Actions

Do not compete with the primary action.

Example:

```text
[ Save changes ]

Cancel
```

Avoid:

```text
[ Save ]
[ Cancel ]
[ Delete ]
[ Duplicate ]
[ Share ]
[ Export ]
```

all receiving equal visual emphasis.

Hierarchy matters.

---

# 29. Destructive Forms

For destructive actions:

```text
Delete account
```

Use stronger confirmation when appropriate.

Do not rely on the same interaction pattern as:

```text
Save profile
```

For extremely consequential actions, consider requiring an explicit confirmation or typed confirmation.

---

# 30. Multi-Step Forms

Do not create multiple steps merely to make the screen look cleaner.

Use multiple steps when:

* The form is genuinely long
* There are natural conceptual sections
* Completing everything at once is cognitively heavy
* Each step has a meaningful objective

Good:

```text
1 Personal
2 Contact
3 Preferences
4 Review
```

Bad:

```text
1 Name
2 Email
3 Phone
4 Address
```

when those fields could comfortably exist on one screen.

---

# 31. Step Progress

If the form has multiple steps, communicate progress.

Examples:

```text
Step 2 of 4
```

or:

```text
● ● ○ ○
```

The user should understand:

* Where they are
* How much remains
* Whether they can go back

---

# 32. Save Progress

For long or expensive forms, consider preserving progress.

Examples:

* Drafts
* Autosave
* Local persistence
* Server-side draft

The longer the form, the more valuable progress preservation becomes.

Never make the user fear losing their work.

---

# 33. Conditional Fields

Do not show every possible field immediately.

Example:

```text
Account type

Personal
Business
```

Only after selecting Business:

```text
Company name
Tax ID
Business address
```

This reduces cognitive load.

---

# 34. Progressive Disclosure

Reveal complexity only when needed.

Prefer:

```text
Basic information
↓
Advanced options
```

over displaying 20 fields immediately.

Advanced options can use:

```text
More options
```

or an expandable section.

---

# 35. Password Fields

Password fields should support:

* Show/hide password
* Appropriate autofill
* Password manager integration
* Clear validation
* Strong but understandable requirements

Do not make password requirements unnecessarily complicated.

If requirements exist, explain them before submission when possible.

---

# 36. OTP / Verification Codes

OTP input should optimize for speed.

Support:

* SMS autofill where available
* Clipboard/paste
* Automatic focus
* Automatic progression
* Clear resend behavior
* Countdown when appropriate

Do not force users to type one digit into six unrelated fields unless the platform interaction genuinely benefits from it.

---

# 37. Search Fields

Search is technically an input but behaves differently.

Optimize for:

* Immediate focus when appropriate
* Clear button
* Keyboard search action
* Debouncing
* Loading state
* No-results state
* Recent searches when useful

Search should not feel like a normal form field.

---

# 38. Numeric Inputs

Use numeric keyboards where appropriate.

But distinguish:

```text
Quantity
Price
Phone
Postal code
PIN
```

They are all numbers but have different semantic behavior.

Never treat every numeric field as the same type.

---

# 39. Currency Inputs

Currency input should:

* Clearly indicate currency
* Format values appropriately
* Avoid unexpected cursor behavior
* Prevent invalid characters
* Handle decimals according to currency
* Preserve user intent

Example:

```text
Price
[ $1,250.00 MXN ]
```

Do not make users manually type currency symbols if the interface can handle it naturally.

---

# 40. Accessibility

Every form must consider accessibility.

Check:

* Label association
* Screen-reader names
* Focus order
* Error announcements
* Dynamic text
* Contrast
* Touch targets
* Keyboard navigation
* Reduced motion

Controls should have sufficiently large touch targets. Apple's accessibility guidance recommends 44×44 pt as the default control size for iOS/iPadOS, with 28×28 pt as the minimum.

Do not make the visible icon tiny and assume the user can accurately tap it.

---

# 41. Touch Targets

Aim for approximately:

```text
44 × 44
```

or larger.

This applies to:

* Buttons
* Checkboxes
* Radio buttons
* Switches
* Clear buttons
* Password visibility buttons
* Date selectors
* Dropdown triggers
* Stepper controls

Spacing matters too.

Two controls placed immediately beside each other increase accidental taps.

---

# 42. Focus State

Focus must be obvious.

For inputs:

```text
Default
Focused
Filled
Error
Disabled
```

The focused state should communicate:

> "This is where your next input goes."

Do not rely on an extremely subtle border-color change.

---

# 43. Disabled vs Invalid

Do not confuse:

```text
Disabled
```

with:

```text
Invalid
```

Disabled means:

> You cannot interact with this right now.

Invalid means:

> You interacted with it, but the value needs correction.

These states need different visual and semantic treatments.

---

# 44. Loading Fields

For fields whose data is loaded asynchronously:

Do not present a normal empty input if the value is not actually available.

Use:

* Skeleton
* Loading state
* Disabled temporary state
* Clear explanation

Avoid misleading users into thinking they can edit unavailable data.

---

# 45. Offline Forms

If the application supports offline usage, decide explicitly:

* Can the form be submitted offline?
* Is it saved locally?
* When is it synchronized?
* What happens if synchronization fails?

Never silently discard offline input.

---

# 46. Form Drafts

For long workflows:

```text
User enters data
↓
Leaves screen
↓
Returns
↓
Data is still present
```

This is often better UX than forcing the user to restart.

---

# 47. Confirmation

Do not show a confirmation dialog for every submission.

If an action can easily be undone:

Prefer:

```text
Saved
Undo
```

rather than:

```text
Are you sure?
```

Reserve confirmation for consequential or destructive actions.

---

# 48. Success State

After successful submission, clearly communicate completion.

Examples:

```text
✓ Product added
```

or transition to the appropriate next screen.

Do not leave the user wondering whether the action worked.

---

# 49. Form Completion

After submission, determine the logical next step.

Examples:

```text
Create product
↓
Product details
```

or:

```text
Save profile
↓
Profile screen
```

Avoid sending users to an unrelated screen simply because navigation is convenient to implement.

---

# 50. Form Density

Do not compress fields excessively.

A good mobile form should have enough space to:

* Scan labels
* Tap inputs
* Read help text
* Distinguish sections

But do not create excessive vertical whitespace that makes the form unnecessarily long.

Use spacing to communicate relationships.

---

# 51. Sectioning

For longer forms, group related fields.

Example:

```text
PERSONAL INFORMATION

Name
[________]

Email
[________]


ADDRESS

Street
[________]

City
[________]

Postal code
[________]
```

Sections should help users understand the structure.

Do not create a section for every two fields.

---

# 52. Form Cards

Do not automatically put the entire form inside a card.

Especially in mobile applications, prefer:

```text
Screen background
↓
Section
↓
Fields
```

Use cards when the form itself needs contextual separation.

Avoid:

```text
Huge rounded card
    ↓
Every input
    ↓
Another card
    ↓
Another card
```

---

# 53. Bottom-Sheet Forms

Use bottom sheets for short, focused forms.

Good examples:

* Add category
* Rename item
* Quick adjustment
* Select quantity
* Add note

Avoid bottom sheets for:

* Large registration flows
* Complex multi-section forms
* Long forms
* Tasks requiring substantial context

If the content requires most of the screen, use a full-screen flow.

---

# 54. Modal Forms

A modal should be used only when the user must focus on a short task.

Do not put a 15-field form inside a tiny dialog.

Use:

```text
Bottom sheet
```

or:

```text
Full-screen form
```

instead.

---

# 55. Mobile Form Anti-Patterns

Avoid:

* Placeholder-only labels
* Tiny touch targets
* Two-column mobile forms
* Desktop dropdowns
* Excessive required fields
* Generic "Submit"
* Validation while typing too aggressively
* Clearing the form after errors
* Keyboard covering inputs
* Keyboard covering CTA
* Long unexplained error messages
* Hidden required fields
* Too many steps
* Confirmation dialogs for harmless actions
* Excessive modals
* Excessive cards
* Excessive helper text
* Unnecessary autocomplete restrictions
* Blocking paste
* Blocking password managers
* Forcing manual OTP entry
* Requiring users to type data the app already knows

---

# 56. Form Review Process

When reviewing an existing form, analyze:

## Information

* Is every field necessary?
* Can anything be inferred?
* Can anything be deferred?

## Layout

* Is the hierarchy clear?
* Is it single-column?
* Is spacing consistent?

## Inputs

* Are labels persistent?
* Are input types correct?
* Are keyboards appropriate?

## Interaction

* Is focus predictable?
* Is scrolling handled?
* Are touch targets large enough?

## Validation

* Are errors clear?
* Are errors placed correctly?
* Is user input preserved?

## Submission

* Is the CTA obvious?
* Is loading handled?
* Is double submission prevented?
* Is success communicated?

## Accessibility

* Can a screen reader understand the form?
* Is focus order logical?
* Is contrast sufficient?
* Are controls large enough?

## Mobile

* Does it work with the keyboard?
* Does it work on small screens?
* Does it work with large text?
* Does it respect safe areas?

---

# 57. Implementation Workflow

When creating a form:

### Step 1

Understand the user goal.

### Step 2

List required information.

### Step 3

Remove unnecessary fields.

### Step 4

Group fields into logical sections.

### Step 5

Choose the correct input type for every field.

### Step 6

Choose appropriate mobile controls.

### Step 7

Design validation behavior.

### Step 8

Design loading/error/success states.

### Step 9

Implement keyboard behavior.

### Step 10

Implement accessibility.

### Step 11

Test small screens.

### Step 12

Review the complete flow.

Do not stop when the form visually renders.

---

# 58. Final Form Quality Checklist

Before finishing:

* [ ] Every field has a clear purpose
* [ ] Unnecessary fields removed
* [ ] Single-column layout
* [ ] Persistent labels
* [ ] Required/optional states clear
* [ ] Correct keyboard types
* [ ] Autofill supported where appropriate
* [ ] Input formatting is forgiving
* [ ] Focus order is logical
* [ ] Keyboard does not obscure fields
* [ ] Keyboard does not obscure CTA
* [ ] Touch targets are comfortable
* [ ] Selectors are mobile appropriate
* [ ] Long lists have search
* [ ] Validation is understandable
* [ ] Errors appear near fields
* [ ] Input is preserved after errors
* [ ] Submit state is handled
* [ ] Double submission prevented
* [ ] Success state exists
* [ ] Error state exists
* [ ] Empty/default states are considered
* [ ] Conditional fields are used where appropriate
* [ ] Long forms have logical sections
* [ ] Multi-step flow is justified
* [ ] Progress is visible when needed
* [ ] Destructive actions are protected
* [ ] Accessibility labels exist
* [ ] Dynamic text is supported
* [ ] Small screens are supported
* [ ] Safe areas are respected
* [ ] Form feels fast and predictable

---

# 59. Final Principle

Do not design forms around:

> "What fields does the database have?"

Design them around:

> "What is the easiest way for the user to accomplish this task?"

The best mobile form is the one where the user barely notices that they are filling out a form.

They simply complete the task.
