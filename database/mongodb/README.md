# MongoDB (NoSQL) part

Database name: `scholarship_nosql` (created automatically on first insert).
MongoDB links to PostgreSQL through the relational primary keys (`scholarshipId`, `userId`, `entityId`).

| Collection | Why NoSQL? | Used for |
|---|---|---|
| `scholarshipextras` | flexible, provider-specific structure | tags, how-to-apply steps, FAQs, links, tips shown on the scholarship detail page |
| `reviews` | free-text, unbounded growth | student ratings & comments on scholarships |
| `activitylogs` | high-volume, append-only, varying `details` | audit trail: login, apply, upload, review, payment, admin actions |
| `notifications` | per-user documents, schema-light | in-app alerts (document verified, status changed, payment released) |

Load the sample data:
```
cd backend
npm run db:seed-mongo
```
Open **MongoDB Compass** -> connect to `mongodb://127.0.0.1:27017` -> database `scholarship_nosql` to see the collections.

Handy shell queries (mongosh):
```js
use scholarship_nosql
db.scholarshipextras.find({ tags: "women" })
db.reviews.aggregate([{ $group: { _id: "$scholarshipId", avgRating: { $avg: "$rating" }, n: { $sum: 1 } } }])
db.activitylogs.aggregate([{ $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
db.notifications.find({ userId: 5, read: false })
```
