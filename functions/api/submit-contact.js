export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();
    // 1. Grab the Turnstile token sent by htmx
    const turnstileToken = formData.get('cf-turnstile-response');

    // 2. Get the user's IP address (highly recommended by Cloudflare for accurate checks)
    const ip = request.headers.get('CF-Connecting-IP');

    // 3. Fallback to Cloudflare's testing secret key if your production environment variable isn't set yet
    const secretKey = env.TURNSTILE_SECRET;
    // 4. Validate the token against Cloudflare's verification endpoint
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: turnstileToken,
        //remoteip: ip,
      }),
    });

    const verifyResult = await verifyResponse.json();
    //
    // console.log(secretKey);
    // console.log(turnstileToken);
    // return new Response(JSON.stringify(verifyResult, null, 2), {
    //   headers: {
    //     'Content-Type': 'text/html; charset=utf-8',
    //   },
    // });

    // 5. If Turnstile flags the submission as a bot, reject the request immediately!
    if (!verifyResult.success) {
      return new Response(
        `<p style="color: var(--red); padding: 1rem; border: 1px solid var(--red); border-radius: 0.5rem;">
          Security verification failed. Please refresh and try again.
         </p>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } },
      );
    }

    // Parse the incoming standard URL-encoded form data sent by htmx
    const firstName = formData.get('first_name');
    const lastName = formData.get('last_name');

    const email = formData.get('email');
    const queryType = formData.get('query');
    const message = formData.get('message');

    // Optional: Put your backend notification or database logging logic here
    // e.g., Send an email via Resend, post to a database, or trigger a Slack webhook.

    // Return the clean HTML layout structure that htmx will swap into the DOM
    const successHTML = `
      <div id="contact-container" style="text-align: center; padding: var(--size-4) 0;">
        <h1 style="color: var(--primary, #000); margin-bottom: var(--size-2);">Thank You!</h1>
        <p>Thanks for reaching out, <strong>${firstName}</strong>. We've received your request regarding "${queryType}" and our team will be in touch with you soon.</p>
      </div>
    `;
    if (env.SEND_EMAIL && env.CONTACT_TO_ADDRESS) {
      const apiBody = JSON.stringify({
        // The sender must be a verified domain/email identity inside your Brevo Account
        sender: {
          name: 'Westmuir Contact Form',
          email: 'no-reply@westmuir.org.uk',
        },
        // Where you want to receive the notification alerts
        to: [
          {
            email: env.CONTACT_TO_ADDRESS,
            name: 'Site Administrator',
          },
        ],
        replyTo: {
          email: String(email),
          name: `${firstName} ${lastName}`,
        },
        subject: `New Contact Submission: ${queryType}`,
        htmlContent: `
          <h3>New Message Received From Westmuir Website</h3>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Query Type:</strong> ${queryType}</p>
          <p><strong>Message:</strong></p>
          <div style="padding: 1rem; background: #f4f4f5; border-left: 4px solid #71717a; white-space: pre-wrap;">
            ${message}
          </div>
        `,
      });

      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': env.BREVO_API_KEY, // Pulls securely from Cloudflare Env
        },
        body: apiBody,
      });

      // Optional: Log error status if Brevo drops the payload
      if (!brevoResponse.ok) {
        const errorText = await brevoResponse.text();
        console.error('Brevo API Error Details:', errorText);
      }
    }

    return new Response(successHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    // Graceful error fallback if something goes wrong on the server side
    return new Response(`<p style="color: var(--red);">Server error. Please try submitting again later.</p>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
