<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Mon Calendrier</q-toolbar-title>
        <q-btn dense flat round icon="menu" @click="drawerOpen = !drawerOpen" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawerOpen" side="right" bordered>
      <q-list padding>
        <q-item-label header>Choisir les utilisateurs</q-item-label>

        <q-item v-for="user in users" :key="user">
          <q-checkbox v-model="selectedUsers[user]" :label="userLabels[user]" />

          <q-input
            dense
            filled
            v-model="userICalUrls[user]"
            :placeholder="'URL iCal pour ' + userLabels[user]"
            class="q-ml-md"
          />

          <q-input dense filled v-model="userColors[user]" class="q-ml-md" readonly>
            <template v-slot:append>
              <q-icon name="colorize" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-color v-model="userColors[user]" />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </q-item>

        <q-btn
          label="Charger les calendriers"
          color="primary"
          class="q-mt-md"
          @click="loadSelectedICals"
        />
      </q-list>
    </q-drawer>

    <q-page-container>
      <q-page class="calendar-page">
        <FullCalendar
          ref="calendarRef"
          v-if="calendarOptions"
          :options="calendarOptions"
          class="fullcalendar"
        />

        <!-- Dialog pour détails de l'événement -->
        <q-dialog v-model="eventDialog">
          <q-card style="min-width: 300px">
            <q-card-section>
              <div class="text-h6">{{ selectedEvent?.title }}</div>
              <div>
                Début: {{ selectedEvent?.startDate ? formatTime(selectedEvent.startDate) : '' }}
              </div>
              <div>Fin: {{ selectedEvent?.endDate ? formatTime(selectedEvent.endDate) : '' }}</div>

              <div v-if="selectedEvent?.location">Salle: {{ selectedEvent.location }}</div>
              <div v-if="selectedEvent?.professor">Professeur: {{ selectedEvent.professor }}</div>
              <div v-if="selectedEvent?.group">Groupe: {{ selectedEvent.group }}</div>
              <div v-if="selectedEvent?.description">
                Description: {{ selectedEvent.description }}
              </div>
            </q-card-section>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import ICAL from 'ical.js';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';

// Ref vers FullCalendar
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null);

// Drawer
const drawerOpen = ref(false);
const selectedUsers = ref<Record<UserKey, boolean>>({
  aksel: true,
  div: true,
  valentine: true,
});

const users: UserKey[] = ['aksel', 'div', 'valentine'];
const userLabels: Record<UserKey, string> = {
  aksel: 'Aksel',
  div: 'Div',
  valentine: 'Valentine',
};

// Charger tous les iCal sélectionnés au montage
onMounted(async () => {
  await loadSelectedICals();
});

// Couleur par utilisateur (défaut)
const userColors = ref<Record<UserKey, string>>({
  aksel: '#1E3A8A', // bleu roi sombre
  div: '#7C3AED', // violet clair
  valentine: '#15803D', // vert foncé
});

// URLs par défaut
const userICalUrls = ref({
  aksel: "http://edt.enib.fr/ics.php?username=a24stervi&pass='YTI0c3RlcnZp'",
  div: "http://edt.enib.fr/ics.php?username=a24stervi&pass='YTI0c3RlcnZp'",
  valentine: "http://edt.enib.fr/ics.php?username=a24stervi&pass='YTI0c3RlcnZp'",
});

type UserKey = 'aksel' | 'div' | 'valentine';

async function loadSelectedICals() {
  const api = calendarRef.value?.getApi();
  api?.removeAllEvents();

  for (const [user, selected] of Object.entries(selectedUsers.value) as [UserKey, boolean][]) {
    if (!selected) continue;

    const url = userICalUrls.value[user];
    if (!url) continue;

    const proxyUrl = `http://localhost:3000/api/ical?url=${encodeURIComponent(url)}`;
    const iCalEvents = await loadICal(proxyUrl);

    const fcEvents = iCalEvents.map((e) => ({
      title: e.title,
      start: e.start,
      end: e.end,
      color: userColors.value[user],
      extendedProps: {
        description: e.description,
        location: e.location,
        professor: e.professor,
        group: e.group,
      },
    }));

    api?.addEventSource(fcEvents);
  }

  drawerOpen.value = false;
}

// Dialog et événement sélectionné
const eventDialog = ref(false);
const selectedEvent = ref<(EventInput & Partial<ICalEvent>) | null>(null);

// Détection mobile
const isMobile = window.innerWidth < 600;

function formatTime(date: Date) {
  return (
    date.getHours().toString().padStart(2, '0') +
    ':' +
    date.getMinutes().toString().padStart(2, '0')
  );
}

// Interface iCal
interface ICalEvent {
  uid: string;
  title: string;
  description?: string | undefined;
  location?: string | undefined;
  start: Date;
  end: Date;
  professor?: string | undefined;
  group?: string | undefined;
}

// Fonction pour charger et parser un ICS
async function loadICal(url: string): Promise<ICalEvent[]> {
  if (!url) return [];
  const res = await fetch(url);
  const text = await res.text();
  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    const description = event.description || '';
    const professorMatch = description.match(/Professeur:(.+)/);
    const groupMatch = description.match(/Groupe:(.+)/);
    return {
      uid: event.uid,
      title: event.summary,
      description: description.trim(),
      location: event.location,
      start: event.startDate.toJSDate(),
      end: event.endDate.toJSDate(),
      professor: professorMatch ? professorMatch[1]?.trim() : undefined,
      group: groupMatch ? groupMatch[1]?.trim() : undefined,
    };
  });
}

// Options FullCalendar
const calendarOptions = ref<CalendarOptions>({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: isMobile ? 'timeGridWeek' : 'dayGridMonth',
  locales: [frLocale],
  locale: 'fr',
  selectable: true,
  editable: true,
  events: [],
  contentHeight: 'auto',
  slotMinTime: '07:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: '01:00:00',
  allDaySlot: false,
  expandRows: true,
  nowIndicator: true,
  slotLabelContent: (arg) =>
    arg.date.getMinutes() === 0 ? `${arg.date.getHours().toString().padStart(2, '0')}:00` : '',
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

  headerToolbar: isMobile
    ? { left: '', center: 'title', right: '' } // flèches cachées sur mobile
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },

  eventClick(info) {
    selectedEvent.value = {
      title: info.event.title,
      startDate: info.event.start,
      endDate: info.event.end,
      description: info.event.extendedProps.description,
      location: info.event.extendedProps.location,
      professor: info.event.extendedProps.professor,
      group: info.event.extendedProps.group,
    };
    eventDialog.value = true;
  },
});
</script>

<style scoped>
.calendar-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.fullcalendar {
  touch-action: pan-y;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden; /* empêche le scroll lors du swipe */
}

/* Header FullCalendar mobile-friendly */
.fc .fc-toolbar-chunk {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fc .fc-button {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
}

/* Condense les lignes de la semaine */
.fc .fc-timegrid-slot {
  height: 30px;
}
</style>
