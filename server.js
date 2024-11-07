const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const app = express();
const { Pool } = require('pg');
const PORT = process.env.PORT || 3000;
const crypto = require('crypto');

// @author jhonbraynrafer
// Initialize PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.pnnsbepdfbqsayaiyeki:NbybnPu6SLBxLQqB@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false, 
  },
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.pnnsbepdfbqsayaiyeki:NbybnPu6SLBxLQqB@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false, 
  },
});


client.connect()
  .then(() => console.log('PostgreSQL client connected successfully'))
  .catch(err => console.error('Connection error', err.stack));

// Middleware
app.use(express.json());
app.use(cors()); 




app.get("/api/location", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM locations");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching location:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.get("/api/relatives", async (req, res) => {
    try {
      const result = await client.query("SELECT * FROM relatives");
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.post("/api/relatives", async (req, res) => {
    const { email, phone } = req.body; // Get email and phone from the request body

    // Check if email and phone are provided
    if (!email || !phone) {
        return res.status(400).send("Email and Phone are required");
    }

    try {
        // Insert the email and phone into the relatives table
        const result = await client.query(
            "INSERT INTO relatives (email, phonenumber) VALUES ($1, $2) RETURNING id",
            [email, phone]
        );
        
        const newId = result.rows[0].id; // Assuming the 'id' is returned after insertion
        res.status(201).json({ id: newId, email, phone }); // Send back the new ID, email, and phone
    } catch (error) {
        console.error("Error inserting relative:", error);
        res.status(500).send("Internal Server Error");
    }
});

  app.put("/api/relatives/:id", async (req, res) => {
    const { id } = req.params; // Get the ID from the URL parameter
    const { email } = req.body; // Get the email from the request body
  
    if (!email) {
      return res.status(400).send("Email is required");
    }
  
    try {
      const result = await client.query(
        "UPDATE relatives SET email = $1 WHERE id = $2 RETURNING id, email",
        [email, id]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).send("Relative not found");
      }
  
      const updatedRelative = result.rows[0];
      res.status(200).json(updatedRelative); // Send the updated relative data in the response
    } catch (error) {
      console.error("Error updating relative:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  
  
  app.delete("/api/relatives/:id", async (req, res) => {
    const { id } = req.params; // Get the ID from the URL parameter
  
    try {
      const result = await client.query(
        "DELETE FROM relatives WHERE id = $1 RETURNING id",
        [id]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).send("Relative not found");
      }
  
      res.status(200).send(`Relative with id ${id} deleted successfully`);
    } catch (error) {
      console.error("Error deleting relative:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  


app.put("/api/location/:id", async (req, res) => {
    const { latlng, latlong } = req.body;
    const { id } = req.params;
  
    try {
      const result = await client.query(
        "UPDATE locations SET latlang = $1, latlong = $2, date = CURRENT_TIMESTAMP WHERE id = $3",
        [latlng, latlong, id]
      );
  
      res.send({ message: "Location updated successfully" });
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  

const transporter = nodemailer.createTransport({
  service: 'Gmail', // You can use 'Gmail', 'Outlook', etc., or configure an SMTP server
  auth: {
    user: 'persaemergency@gmail.com',
    pass: 'xrorzyadclwdhihv',
  },
});


app.post('/api/send-email', async (req, res) => {
    const { subject, html } = req.body;
  
    const defaultHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffdddd; color: #b00; border: 2px solid #b00; border-radius: 5px; max-width: 600px; margin: 20px auto;">
        <h2 style="color: #b00; font-size: 24px; text-align: center;">🚨 URGENT: Immediate Assistance Needed!</h2>
        <p style="font-size: 18px; font-weight: bold; color: #b00; text-align: center;">This is an emergency alert! A person requires urgent assistance at the following location.</p>
        <p style="font-size: 16px; color: #b00; font-weight: bold;">Location of the person in need:</p>
        <p style="font-size: 18px; font-weight: bold; text-align: center;">
          <a href="{{mapLink}}" target="_blank" style="color: #b00; text-decoration: none; font-size: 20px; font-weight: bold;">📍 View Location of Person Needing Help</a>
        </p>
        <br>
        <p style="font-size: 16px; color: #b00;">Please act immediately. Contact emergency services if necessary to provide assistance.</p>
        <p style="font-size: 14px; color: #b00;">Time is of the essence. Your quick response could make a difference.</p>
      </div>
    `;
  
    try {
      // Query up to 10 email addresses from the relatives table
      const relativesResult = await pool.query('SELECT email FROM relatives LIMIT 10');
      const relatives = relativesResult.rows;
  
      // Query a single location (one row) from the locations table for the person needing help
      const locationResult = await pool.query('SELECT latlang, latlong FROM locations LIMIT 1');
      const location = locationResult.rows[0];
  
      // Ensure a location is found
      if (!location) {
        return res.status(404).json({ message: 'No location found for the person needing help.' });
      }
  
      // Generate Google Maps link for the person's location
      const mapLink = `https://www.google.com/maps?q=${location.latlang},${location.latlong}&hl=en`;
  
      // Send the same location to each relative
      for (const relative of relatives) {
        // Modify the HTML email content to include the map link
        const personalizedHtml = `
          ${html || defaultHtml.replace("{{mapLink}}", mapLink)}
        `;
  
        await sendEmail(
          relative.email,
          subject || '🚨 URGENT: Immediate Assistance Needed!',
          personalizedHtml
        );
      }
  
      res.status(200).json({ message: 'Alert emails sent successfully to up to 10 relatives.' });
    } catch (error) {
      console.error("Error sending alert emails:", error);
      res.status(500).json({ message: "Failed to send alert emails.", error });
    }
  });
  

const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: 'persaemergency@gmail.com',
    to: to,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
};

  
app.post("/api/location", async (req, res) => {
    const { latlang, latlong, name } = req.body;

    // Validate input parameters
    if (!latlang || !latlong || !name) {
        return res.status(400).send("All fields are required");
    }

    try {
        // Insert into the database
        const result = await client.query(
            "INSERT INTO locations(latlang, latlong, name) VALUES ($1, $2, $3) RETURNING id",
            [latlang, latlong, name]
        );

        const newId = result.rows[0].id;  // Get the new inserted row's ID

        // Return the inserted location data
        res.status(201).json({ id: newId, latlang, latlong, name });

    } catch (error) {
        console.error("Error inserting location:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
