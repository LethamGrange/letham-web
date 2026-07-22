---
layout: base.webc
title: Our Facilities
---

<div class="full-width with-bg">

## History of the club

<two-columns>

<div slot="left">



Letham Grange Curling Club started in 1984 when the purpose built rink was opened on the 30th September 1984 by the Scottish Rugby Captain Jim Aitken in the Letham Grange House Hotel. There were over 100 members in the first year with many club competitions being played with the trophies being donated by The Bank of Scotland, the Contractors who built the rink and local business people. These trophies are still played for today. Our first President was Jim Milne who later became our Hon. President in 2024 at our 40th Anniversary celebrations. There have been many long serving officials who must be thanked for their dedication in keeping the club going through the past years. Some of the founder members were still playing in the 40th Anniversary Bonspiel. In 2002 when the rink closed LGCC continued to play the Club, Province, Inter Club, Rink and Area competitions in Forfar Ice rink. Letham Grange members have been active across a wide range of positions at Province, Area and the Royal Caledonian Curling Club. Brian McArtney became RCCC President in season 2019-2020 with Janine Wilson and Mari Milne serving on the RCCC Board. LGCC members have also supported the development of curling by being coaches, umpires or time keeper at local, national and international levels. Many LGCC members have excelled on the ice at national and international level with many becoming Scottish, European and World Champions.

  </div>


  <div slot="right">
Our approach is focused on understanding your needs and providing practical solutions. From personalized consultations to hands-on assistance.

      <img src="/images/letham-opening-plaque.png" width="300" alt="Club main pitch" />

  </div>
</two-columns>

</div>

<hr class="ui-divider ui-border-filled" />


## Key Contacts

Who to talk to if you have any questions about the club.

<div class="custom-table-container">


|Position 	|Name 	|Email/ Contact details|
|---|---|---|
|President 	|Dave Piggot 	|president@lethamgrangecc.org.uk|
|Secretary 	|Brian McArtney 	|secretary@lethamgrangecc.org.uk|
|Treasurer 	|Kirstina Fairweather 	|treasurer@lethamgrangecc.org.uk|
|Child Wellbeing and Protection officer 	|Jane McArtney 	|wellbeing@lethamgrangecc.org.uk|
|Match Secretary 	|Philip Ross 	|match-secretary@lethamgrangecc.org.uk| 

</div>

<style>
.with-bg {
--with-bg-color: var(--primary) ;
color: var(--gray-2);
}
.with-bg h2 {color: var(--gray-2);}
h2,h3 {color: var(--color-6);}

/* Ensure the scroll-panel rules stay isolated inside your custom wrapper class */
.custom-table-container {
  overflow-x: auto;
  max-width: 100%;
  margin-block: var(--size-4);
  border-radius: var(--radius-2);
  box-shadow: var(--shadow-2);

  /* Target the automatically generated Markdown tables */
  table.ui-table {
  
    /* 1. UPGRADE THE HEADER TO THE BG ACCENT BRAND COLOR */
    thead th {
      /* Force it to pull your master accent background blue (--blue-8) */
      background-color: var(--primary);
  
      /* Ensure text utilizes the crisp high-contrast variant we locked in */
      color: var(--primary-contrast);
  
      font-weight: var(--font-weight-7);
      border-bottom: 2px solid var(--border);
    }
 tbody tr {
      background-color: var(--surface-default);
    }
    /* 2. AUTOMATE ZEBRA STRIPING FOR ALTERNATING ROWS */
    /* Light Mode default: Subtle slate tint on every even row item */
    tbody tr:nth-child(even) {
      background-color: oklch(from var(--surface-default) calc(l * 0.75) c h);

        td{
          background-color: inherit;
        }
    }

    /* 3. OPTIONAL: FLUID HOVER ROW SHIFT EFFECTS */
    tbody tr:hover {
      background-color: var(--surface-filled);
      cursor: pointer;
    }
  }
}

</style>
