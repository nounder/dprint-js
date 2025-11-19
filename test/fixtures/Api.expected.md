# API Documentation

## Authentication

### POST /api/login

Login to the system.

**Request Body:**

```json
{"username":"user@example.com","password":"secret123"}
```

**Response:**

```json
{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9","expiresIn":3600}
```

## Users

### GET /api/users

Get all users.

- **Auth required:** Yes
- **Permissions:** admin

### POST /api/users

Create a new user.

- **Auth required:** Yes
- **Permissions:** admin

### DELETE /api/users/:id

Delete a user.

- **Auth required:** Yes
- **Permissions:** admin
