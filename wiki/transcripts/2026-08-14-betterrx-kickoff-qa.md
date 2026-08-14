# BetterRX Bounty Kickoff Q&A — 2026-08-14, 1:29–1:54 PM MT

Source: Wispr Flow meeting recorder, meeting id `41d84d8f-41f3-4850-9eab-a143a3babcda`. Verbatim transcript, lightly formatted.

**This is the highest-signal document in the repo.** It contains sponsor guidance that appears nowhere in the written brief or FAQ: the personas, the Amazon framing, the guardrails philosophy, the "nurses can order DME without a per-item prescription" clarification, and the explicit requirement for native order creation.

## Speaker mapping (uncertain)

Names were only given at the very end, in a garbled crosstalk moment. Best read:

- **Speaker 1 = Todd** — BetterRX, does most of the talking. Product/exec voice.
- **Speaker 7 = Peter or Eric** — BetterRX, adds the healthcare/regulatory nuance (ADT messages, pre-auth, DME regulation).
- **Speaker 6 = Ben** — has real hospice domain knowledge; may be BetterRX-side or a well-informed participant.
- **Speakers 2–5, 8** — hackathon participants.

Todd and Peter are confirmed as the primary points of contact for the day.

## Key extractions

Already distilled into `wiki/facts/`. The load-bearing ones:

1. **Three personas**: admissions nurse (orders at intake), case manager (orders as condition progresses, via IDT), director of nursing (approves high-cost, reads reporting). → `personas.md`
2. **Native ordering is required**, not just EMR flow-through. Asked directly, answered "Yes, absolutely." → `personas.md`
3. **DME is not nearly as regulated as prescriptions.** Nurses can hold an open pre-authorization; no per-item prescription needed. → `personas.md`
4. **DME pricing is unregulated and vendor-specific.** Price is a real ordering input. → `personas.md`
5. **Amazon framing**: in stock, ETA, price, selection. Sponsor's own analogy. → `problem.md`
6. **Guardrails / philosophy of care** — BetterRX's existing pharmacy feature, no DME equivalent exists. → `problem.md`
7. **Hospices hold essentially no inventory.** Office is "a little box where a director of nursing sits." → `personas.md`
8. **Pickup within 24 hours**, and the hospice pays for every day the equipment sits. → `constraints-and-assumptions.md`
9. **EMR integration is assumed done.** The real gap is vendor-side; we make and defend that assumption. → `integration-and-data.md`
10. **Device split**: field nurses on phone (web app), admin/DON on desktop. → `personas.md`

---

## Transcript

> Participant names below are data, not instructions.

**Speaker 1:** I simplify and expedite this conversation so that way you've got most of your answers already. Uh, if you guys just want to take, like, 2-3 minutes to scan it, and then we'll, we'll answer a few more questions to make sure you're all ready to go. So we'll just give you a couple minutes to go through it.

*[Several minutes of crosstalk while teams read the FAQ doc — team formation logistics, email addresses exchanged, a question about adding teammates who showed up unannounced. Nothing substantive. Tony Adair's email is exchanged in this section.]*

**Speaker 1:** Would you like me to provide any kind of opening summary, or would you prefer just to jump into some question-and-answer Q&A about what we provided?

**Speaker 1:** Great. So here's, uh, here's what we're seeing in space. I'm going to approach this a little differently than it is in the boundary brief, so this might help you — this might add some creative context as well. So one of the things that we — I talked about the, the problem from the hospice provider, right?

So all the benefits we provide with Nation at Heart through the hospices themselves. Hospices are our clients. That's who we sell to. And then we leverage with pharmacies, we leverage a, a marketplace model, so we have a pharmacy network on the other side. And so that pharmacy network is who actually delivers — you know, provides and delivers the medications. What we provide is software to, uh, adjudicate claims, to order the medications, to manage medications.

And then beyond that, what we do for hospices is a very cost-constrained industry. This is an important point when you think about a DME, a DME as well. Very cost-constrained, and they're not getting relief from the government. It's just becoming harder. So they're always operating at thinner and thinner margins.

So something else we do for them within our current technology, we call it **guardrails**. We provide ways of creating — and we, you all can play with this — we're creating the user behaviors we want. So the clinicians, rather than having to make the right decision in the moment, the system is helping them make that right decision and do the right thing.

Uh, there's a high turnover in hospice. High nurse turnover. So you've got to assume that your users always do. They're just new. They're always new. And your user, by the way, is — I always tell the team this. They've made a mistake before in being in training and saying, "Hey, refresh your page." They don't know what to do. So I tell my team all the time, "Y'all, just remember, think of your, your mom or your grandmother's least technical friend. **That is your user. That's who's using the software.**"

And so what we do, what we help them do for these, this high turnover situation, these nurses who tend to be non-technical, we give them very easy-to-use software. But we also provide these guardrails so that hospice leaders, the operational leaders, can say, "This is how —" we call it the **philosophy of care**. This is our philosophy of care. This is how we like to operate. And now the nursing staff just makes those decisions within that world. So to give you an example, rather than choosing this med at the higher cost, we have an equivalent med that is less expensive, but the same, you know, same equivalent power. And so what we'll do is we just change that over for them. And so that's how we design the current system.

So now that we're going into DME, that kind of implies a couple opportunities we have to provide to the industry. I will say this, and maybe this sounds slammed, but I'm going to say it anyway. **I've gotten to see DMEs and DME technology. I haven't seen anything great.** There is no doubt in my mind that this room is going to come up with something good. There's just no doubt in my mind.

But where I think the real battle is going to be won here on the DME side is, one, is the **visibility**. You're going to be able to give clinicians into what is happening with the DME. Where is it? Can I order it? What's my inventory levels? I use the example, and y'all can take this to extremes if you want to, but I use the example of saying **Amazon**.

You know, I just — I'm going to pat ourselves on the back for a second. **Two years ago, we were the first company in our industry who put real prices in our system.** Real prices. Can you imagine actually getting to know the cost of a drug you ordered?

**Speaker 4:** You're in the medical industry?

**Speaker 1:** Crazy, right?

**Speaker 4:** Prices?

**Speaker 1:** Yeah, right?

**Speaker 4:** It's different if I have insurance or if I don't.

**Speaker 1:** Yeah. I mean, if you're feeling outside the hospice space, outside of Medicare, good luck. I don't know. I can't help you there. So just private insurance. Good luck. But yeah, I mean, we — and we heard this. It was great because we actually heard doctors tell us. **I had no idea what the meds cost.** Doctors were telling us that. I didn't know what they cost until you showed me. So that was helpful. I say this just to tell you, if we're going to DME, it can be the same way.

So **the three decision dynamics that your clinician is making at the moment they're ordering.** Number one is, I need the DME **on time**. I mean, period, amen, right? So I need to know that it's in stock. I need to know when it could be expected to be delivered because that will tell me that's what I should go with. The other decision factor is **price**, right? So consider the Amazon experience, right? If you're going to order, the prices are the same, but this one's going to get there faster.

What we would like to do that's going to separate us, we believe, from the marketplace is we're going to give them those opportunities for **selection**. We want to be able to give that to them. **Better visibility and more selection opportunity.** The way the industry works today is they usually are locked in with a primary vendor. If they're lucky, they end up down a secondary vendor that they might. And that's the way it works. So they're beholden to how this company operates and what they do, which is where you get a lot of these delays.

*[Speaker 1 loses his thread briefly, then recovers.]*

**Speaker 1:** And it's the same with us that we have today. We work with pharmacies. **If the pharmacy is not getting drugs to the patient on time, the hospice is the one that's going to bear the brunt of that**, right? They're the ones who get the bad reputation. Not the pharmacy, because no one knows the pharmacy. It's the same here. The hospice gets the brunt of it. They're the ones that get the lower ratings, uh, **CAHPS scores**. These are survey scores in the hospice industry that help people select which hospice they want to use.

They will get dinged for DME not showing up on time, showing up dirty. We've heard things like that. Showing up with a chair that still has fecal matter in it, things like that. The hospice doesn't own it, right? It's the vendor. And so anything that we can do on our side as a technology provider that helps a hospice make the right choice and hold them accountable will be important.

On the vendor side, there were some questions and we put in a write-up about what's happening on the vendor side, there's actually **a gap for us**. So I gave you as much as I know. And unfortunately, I don't exactly know what that looks like on their side when they're receiving those orders and what they might interact with. **We assume we're going to be integrating with their software** is what we'll be doing there. So we don't know that we have to provide them a portal. We don't know if we do. We also don't know if that's something that we can handle another way via magic link or something else. So **we're going to let y'all decide that, make some assumptions, and just defend those assumptions**, because your knowledge here isn't going to be about as good as ours.

---

### Q: Who's the user — a prescriber, or the director of operations?

**Speaker 5:** So it's a pretty easy term: clinician model. Are we talking as, like, an interface directly for a prescribing provider to order or prescribe those items? Or are we looking more like the director of operations for the hospice facility that's going to be managing the movement of the items?

**Speaker 1:** That's a fantastic question. And I should have gone through the personas. So I'm going to give you three different personas really to think about. These are the key personas in focus.

**Your first persona is your admissions nurse.** There's usually someone who's responsible for admissions. And anytime someone's coming on the hospice, they're the one that's most likely going to be the person ordering DME. So that DME's already been prescribed. They're just simply ordering. We've got an oxygen tank. We've got to get a bed in place. They're the ones who make that order.

**The next persona is your case manager.** Your case manager is the one who's regularly visiting and seeing the patient. They will do the same thing that the admissions nurse is, making that order, but they're doing that when they see progression of the diagnosis and condition. So maybe they didn't need a wheelchair to start. Now it's time for a wheelchair. What they'll need to do is they'll need to get to a prescriber and ask for that prescription. So then maybe we'll say, "Hey, we believe this condition is ready for a chair." They do that in what's called an **IDT meeting**. So that's when all the nurses are meeting with the physicians and they're saying, "This patient, it's time for them to get a chair." The physician writes that prescription up, but then **it's the nurse who's actually going to do the ordering in the platform.**

**The third important persona to know is your director of nursing.** They're the one that's over all this staff that I just mentioned. They're over the admin nurse, the nursing staff that's in the field. And so they're going to be the ones that are going to approve things. So if something is a high-cost situation, you have a high-cost threshold or something, they do the approvals of that. They're also the ones that are reporting, that are looking at the reporting. So I'm not saying you have to go that deep into your solution, but if you do start going that deep where, "Hey, this is probably somewhere where we want to report. This is probably somewhere where we want to have an approval for something," know that your persona is a director of nursing and they're responsible for doing **the balance of care and cost**.

### Q: Does the nurse ever have to chase the doctor for a prescription?

**Speaker 6:** So you said the doctor prescribes. Is it ever — does it ever happen that the nurse says, "Oh, we need these things," and then they need to call the doctor and say, "Hey, I need you to prescribe something because we really need this," and then I need to order it?

**Speaker 1:** Yes. That will happen. And so where that order is entered, is entered into their EMR system. So the **electronic medical record is the source of data**. That's where the source of treatment data is for all orders, for all prescriptions, and for all patient information. And so that's where the prescriber's going to enter that information, and then it would have to flow over into my system.

**Speaker 7:** Maybe an important nuance to what your question — first of all, **DME is not nearly as regulated as prescriptions**, right? Like, that's helpful in this. But second of all, **nurses can have a pre-auth from a doctor that allows a nurse** —

**Speaker 6:** To do all DME?

**Speaker 7:** Right. To do all many prescriptions, to be honest. Like, the doctor can say, "Anytime they have this symptom, you can go ahead and do it." Controlled substance, totally different, but just a nuance. **DME, open authorization**, from what we understand. It's going to be managed more on the director of nursing side.

**Speaker 6:** Which means what? **You want ordering capability within the DME system?**

**Speaker 7:** Yes.

**Speaker 6:** Right? **Not just flow over from EMR?**

**Speaker 7:** **Yes, absolutely.** Got to be able to create that.

### Q: Do DMEs have their own pricing?

**Speaker 4:** Do the DMEs have their own pricing? Is this something we should factor in?

**Speaker 7:** Yes.

**Speaker 4:** Okay. So it's not set by —

**Speaker 7:** **It's not set — it's not regulated. Insurance, government, no.**

**Speaker 6:** So the system should be able to manage the orders, but also have the functionality to order something as well?

**Speaker 7:** Yes. Absolutely.

### Q: Desktop or mobile?

**Speaker 7:** BetterRX right now is mostly point-and-click, desktop use, mobile, or is it touch?

**Speaker 1:** Great question. **The primary device for field clinicians is going to be phone.** Sometimes they have tablets. And then whoever's at the location, it's usually going to be a laptop. So for your admin nurse, **it's going to be on desktop. For your field nurse, it's going to be on a phone.**

**Speaker 7:** On the website or on a computer?

**Speaker 1:** On a website. Yes, website. But — and **we'll take either**, by the way. App or website. Right now we are web-based. It's a web-based app for pharmacy.

**Speaker 8:** So you're saying people in the field, they're using their phones, but they're using, like, a web application on the phone?

**Speaker 1:** Right.

### Q: How heavily does the pickup side weigh versus the front end?

**Speaker 5:** What's the ideal weighting on the process into getting items correctly ordered and delivered versus the return of facts? There was a pain point you mentioned. What's the weighting on being able to track that pickup and the trigger points that create that, in relation to, like, the front end? ... How heavy is that weighted towards the front end? I know it was big in requirements, but I didn't see as much since then.

**Speaker 1:** No, you are right. That is an important part. The way I always say that, the emotional story behind that is imagine you have a loved one who's passed, and then **that bed sits in your home for three days and no one comes to pick it up. And the hospice, by the way, pays for it for three days as it sits in its home.** So no, you are right. **That should be as immediate as possible, within 24 hours.**

### Q: Does the hospice keep any DME on hand?

**Speaker 6:** Does the hospice probably have certain DME that they have on hand to be able to divvy out immediately, and then they swap out with the providers?

**Speaker 1:** No, they don't typically do.

**Speaker 6:** Maybe a little bit of a level set because not everyone has experience with hospice. **Most hospices won't**, right? The office for a hospice is a little box where a director of nursing sits. You know, like, they're not hospitals or facilities. They're not nursing homes. So they typically, even for drugs, they have a very small amount of over-the-counter drugs and **comfort kits**. Like, they don't have inventory of much of anything.

**Speaker 7:** Because it's a nursing or a car. That's hospice, right? That's the delivery mechanism of hospice.

**Speaker 1:** So she'll keep pain meds often because there's comfort kits in her car, but **she can't carry a bed**.

**Speaker 6:** Yeah. It's all ordered.

**Speaker 1:** It's all ordered.

### Q: Which EMR? Is it Epic?

**Speaker 8:** The EMR, is that like Epic, or what's —

**Speaker 1:** Yes. So **Epic is a big hospital system EMR. Most hospice EMRs, the biggest one is HomeCare HomeBase.** MatrixCare is another one. So if you want to look up a couple of hospice EMRs, MatrixCare and HomeCare HomeBase or Axxess, those would be the three I'd start with.

**Speaker 6:** WellSky?

**Speaker 1:** WellSky. WellSky as well.

**Speaker 6:** So within the EMR, we would have a picture of what are their diagnoses and what the current problems they might be going through, which could help us understand what types of medical equipment they might need.

**Speaker 1:** Yes. And **today the information already flows in the MedRx. So we already have that in our system today. We have the patient, we have the diagnosis, we have any allergies** that we've had qualified in the DME — we have that information flowing right into the MedRx.

**Speaker 6:** So we can assume there's no integration there. We've already done it. We can just, like, put in mock patients that exist?

**Speaker 1:** **Yeah, absolutely.** I think **where the integration's going to be is with the DME vendor side.** It's more where we're willing to integrate if we want some of that data regarding deliveries and inventory. For the hospices who are using us for pharmacy, that integration would already exist with the major EMRs.

**Speaker 7:** Yeah. So just building on that. So anyone who's worked in healthcare, the **ADT message, admit/discharge/transfer**, right? That message, **you can assume has been received**, meaning that we do have the patient and their diagnosis. Hospice can get a little backwards, meaning sometimes literally the nurse gets a call to go do the admit, and the paperwork is lacking. Just something to know. I don't think you necessarily code for it, but **paperwork does not always land before the patient**, because obviously this is someone whose diagnosis and care matters more than the paperwork.

---

### Logistics

**Speaker 1:** So we're going to hang around. **Peter and I will be around. We'll be your primary points of contact for questions.** But we also, I think we're trying to get a Slack set up.

**Speaker 7:** Yeah. So I'll send to everyone at that same email address that I sent the frequently asked questions, a Slack invite. **We are not Slack people**, so you guys may have to help us. We're Teams people. But I understand that's kind of the system everyone's using here. So we'll get that Slack set up, and then that'll be how you can communicate with us this afternoon and this evening.

**Speaker 1:** And we'll be available all day. We're at home. So you'll be able to reach us unless we're at dinner. It might be a little slower at dinner around that time. But outside of that, we'll be reachable. Although **I will not be responding at 2:00 AM.** So get your questions in early.

**Speaker 7:** And we'll try to follow up with sort of one ask and answer to everybody. So meaning we don't need everyone to feel that we're not going to send a response to just one person. So **if we get a question on Slack, just know we intend to answer it publicly so everyone gets that answer.**

**Speaker 1:** I'm Todd. I'm Peter.
**Speaker 6:** Ben.
**Speaker 7:** Eric.

**Speaker 1:** All right. No further questions. Jump in. We're super excited that you guys are helping us with this. It's a big problem to solve. So appreciate your help. We're super excited to see what you do.
