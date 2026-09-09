# Hotel AI Postman suite

## Import

Import both files into Postman:

1. `Hotel-AI.postman_collection.json`
2. `Hotel-AI-Local.postman_environment.json`

Select **Hotel AI - Local**, then set `adminEmail` and `adminPassword` to an existing
SUPER_ADMIN account. Keep secrets in the environment's local/current values rather
than shared initial values.

Start the API on `http://localhost:6000` and run **00 - Health** first. Run the numbered
folders in order when you want the captured IDs to flow automatically. The registration
request creates a disposable customer and captures its access/refresh tokens.

## Important workflow notes

- Mutation and cleanup requests are named explicitly. Review them before using Collection Runner.
- Google requests need a fresh frontend-issued Google credential and remain deferred until frontend testing.
- Image upload needs `roomImagePath` or a manually selected image file, plus Cloudinary credentials.
- Payment/refund requests need Paystack credentials and valid provider state.
- Staff onboarding needs Sendlib configured; use a SUPER_ADMIN token.
- Service-request creation needs `checkedInReservationId` belonging to the active customer.
- AI requests can return `429` when the free Gemini/project quota is exhausted.
- For the rate-limit folder, restart the API first and run only that folder in order.
- Run logout, archive, cancellation, deletion, confirmation, and refund requests only at their labelled point.

## Dates

The environment defaults to October 10–12, 2030. Change `checkIn`, `checkOut`, and
`dashboardDate` if those dates are no longer suitable or conflict with existing test data.

## Coverage

The suite contains every currently mounted endpoint plus core validation and authorization
boundaries. Response scripts capture reusable tokens and IDs in the selected environment.
