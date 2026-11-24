/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("climbing_logs");

  // Record 1
  const record1 = new Record(collection);
  record1.set("title", "Sending My First V5: The Nautilus");
  record1.set("date", "2026-06-01 10:00:00.000Z");
  record1.set("location", "Gunks, NY");
  record1.set("climbType", "Bouldering");
  record1.set("grade", "V5");
  record1.set("style", "Send");
  record1.set("content", "<p>It took me 4 sessions, but I finally sent <strong>The Nautilus (V5)</strong>! The crux was the dynamic move to the sloping lip. I kept slipping off due to poor friction, but today the weather was cool and crisp, providing the perfect conditions.</p><p>Key takeaway: Trust the heel hook and keep the body tension high!</p>");
  record1.set("isDeleted", false);
  app.save(record1);

  // Record 2
  const record2 = new Record(collection);
  record2.set("title", "Projecting High Exposure: A Multi-pitch Classic");
  record2.set("date", "2026-06-08 08:30:00.000Z");
  record2.set("location", "Gunks, NY");
  record2.set("climbType", "Trad");
  record2.set("grade", "5.6");
  record2.set("style", "Project");
  record2.set("content", "<p>Today we set out to climb <em>High Exposure (5.6)</em>, one of the most famous trad climbs in the Gunks. The second pitch roof is notoriously airy. The exposure is real, and stepping out over the lip into empty space is a true mental test.</p><p>We didn't finish the final pitch due to an incoming thunderstorm, but it was an incredible experience that I can't wait to complete next weekend.</p>");
  record2.set("isDeleted", false);
  app.save(record2);
}, (app) => {
  const records = app.findRecordsByFilter("climbing_logs", "title ~ 'The Nautilus' || title ~ 'High Exposure'", "");
  for (const record of records) {
    app.delete(record);
  }
})
