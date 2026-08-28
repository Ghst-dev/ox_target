/**
 * Icon resolution: FontAwesome names in, Lucide geometry out.
 *
 * A copy of ox_lib's lib/icons.ts, deliberately. Per the no-cross-resource-unification
 * decision these forks share a design language, not a package — each resource stays
 * independently buildable and independently deployable. Keep the two in step by hand when
 * adding icons; the map is the only part that ever needs to match.
 *
 * ## Why a map and not a registry
 *
 * ox_target's icon API is a **FontAwesome class string**, not a name: consumers write
 * `icon = 'fa-solid fa-car'`. Those arrive at *runtime*, so nothing can be inferred at
 * build time. FontAwesome handled that by registering whole packs — 27 MB in node_modules.
 * Before that, the original UI pulled FontAwesome's stylesheet off a CDN, which fails
 * outright in CEF with no internet and rendered every icon as an empty box.
 *
 * Around a hundred distinct names are used across the entire server, so this is an explicit
 * allowlist instead: every icon is a static import, the bundler drops the other ~1700, and
 * a name nothing sends costs nothing. The trade is that adding an icon is a line in this
 * file rather than something that just works -- and that a name which is missing renders
 * *nothing* in a production build, silently, because `resolveIcon` returns null.
 *
 * So check the name is here when adding a caller. Two rounds have already slipped through:
 * the `success` notification's default `circle-check`, and ghst_hud's money and needs
 * toasts. The latter write their name as `icon = cond and 'a' or 'b'`, which a grep for
 * `icon = '...'` does not match -- sweep for quoted strings on any line assigning `icon`.
 *
 * ## Why normalisation exists
 *
 * Names arrive in four different shapes across the server:
 *
 *     'car'                bare
 *     'fa-wrench'          hyphen-prefixed
 *     'fa-solid fa-car'    full CSS class string
 *     'fas fa-pen'         legacy class string
 *
 * ox_target only ever sees the last two, but normaliseIconName accepts all four so this
 * file can stay identical to ox_lib's.
 *
 * ## Substitutions
 *
 * Eight names have no Lucide equivalent. All eight are GTA-RP props living in content
 * config, not framework UI, so the nearest neighbour is a cosmetic choice:
 *
 *     vest, mitten, hat-cowboy-side, user-tie   clothing categories in qbx_radialmenu
 *     torii-gate                                a menu entry labelled "Gate"
 *     dumpster                                  ox_inventory's dumpster search target
 *     scalpel                                   illenium's surgeon ped
 *     car-burst                                 labels the vehicle-*flip* action, where a
 *                                               crash icon was already the wrong picture,
 *                                               so RotateCcw is an improvement
 *
 * `handcuffs` and `bong` appear only in ox_target's debug file and never ship.
 *
 * `duck` is deliberately absent: `qbx_core/config/client.lua:69` uses it as a Discord Rich
 * Presence image asset name, not an icon, and it never reaches NUI.
 */

import Archive from 'lucide/dist/esm/icons/archive.mjs';
import Armchair from 'lucide/dist/esm/icons/armchair.mjs';
import Baby from 'lucide/dist/esm/icons/baby.mjs';
import Bandage from 'lucide/dist/esm/icons/bandage.mjs';
import Banknote from 'lucide/dist/esm/icons/banknote.mjs';
import BatteryCharging from 'lucide/dist/esm/icons/battery-charging.mjs';
import Bell from 'lucide/dist/esm/icons/bell.mjs';
import Book from 'lucide/dist/esm/icons/book.mjs';
import BookUser from 'lucide/dist/esm/icons/book-user.mjs';
import Box from 'lucide/dist/esm/icons/box.mjs';
import Briefcase from 'lucide/dist/esm/icons/briefcase.mjs';
import Calculator from 'lucide/dist/esm/icons/calculator.mjs';
import Calendar from 'lucide/dist/esm/icons/calendar.mjs';
import CalendarDays from 'lucide/dist/esm/icons/calendar-days.mjs';
import Cannabis from 'lucide/dist/esm/icons/cannabis.mjs';
import Car from 'lucide/dist/esm/icons/car.mjs';
import CarFront from 'lucide/dist/esm/icons/car-front.mjs';
import CarTaxiFront from 'lucide/dist/esm/icons/car-taxi-front.mjs';
import Check from 'lucide/dist/esm/icons/check.mjs';
import ChevronDown from 'lucide/dist/esm/icons/chevron-down.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import ChevronUp from 'lucide/dist/esm/icons/chevron-up.mjs';
import Cigarette from 'lucide/dist/esm/icons/cigarette.mjs';
import Circle from 'lucide/dist/esm/icons/circle.mjs';
import CircleAlert from 'lucide/dist/esm/icons/circle-alert.mjs';
import CircleCheck from 'lucide/dist/esm/icons/circle-check.mjs';
import CircleChevronLeft from 'lucide/dist/esm/icons/circle-chevron-left.mjs';
// Aliased: the export is CircleHelp, the file is circle-question-mark.mjs. Lucide keeps
// renamed icons reachable under their old export names, so an export name is not a
// reliable guide to a filename — check the file exists when adding one.
import CircleHelp from 'lucide/dist/esm/icons/circle-question-mark.mjs';
import CircleUser from 'lucide/dist/esm/icons/circle-user.mjs';
import CircleX from 'lucide/dist/esm/icons/circle-x.mjs';
import Cloud from 'lucide/dist/esm/icons/cloud.mjs';
import CloudUpload from 'lucide/dist/esm/icons/cloud-upload.mjs';
import Cpu from 'lucide/dist/esm/icons/cpu.mjs';
import DoorOpen from 'lucide/dist/esm/icons/door-open.mjs';
import Drama from 'lucide/dist/esm/icons/drama.mjs';
import Droplet from 'lucide/dist/esm/icons/droplet.mjs';
import EarOff from 'lucide/dist/esm/icons/ear-off.mjs';
import Ellipsis from 'lucide/dist/esm/icons/ellipsis.mjs';
import Eye from 'lucide/dist/esm/icons/eye.mjs';
import EyeOff from 'lucide/dist/esm/icons/eye-off.mjs';
import Fence from 'lucide/dist/esm/icons/fence.mjs';
import Footprints from 'lucide/dist/esm/icons/footprints.mjs';
import Fuel from 'lucide/dist/esm/icons/fuel.mjs';
import Glasses from 'lucide/dist/esm/icons/glasses.mjs';
import Globe from 'lucide/dist/esm/icons/globe.mjs';
import Hand from 'lucide/dist/esm/icons/hand.mjs';
import HardHat from 'lucide/dist/esm/icons/hard-hat.mjs';
import Heart from 'lucide/dist/esm/icons/heart.mjs';
import HeartPulse from 'lucide/dist/esm/icons/heart-pulse.mjs';
import Hourglass from 'lucide/dist/esm/icons/hourglass.mjs';
import IdCard from 'lucide/dist/esm/icons/id-card.mjs';
import Inbox from 'lucide/dist/esm/icons/inbox.mjs';
import Info from 'lucide/dist/esm/icons/info.mjs';
import Key from 'lucide/dist/esm/icons/key.mjs';
import Landmark from 'lucide/dist/esm/icons/landmark.mjs';
import Lightbulb from 'lucide/dist/esm/icons/lightbulb.mjs';
import Link from 'lucide/dist/esm/icons/link.mjs';
import List from 'lucide/dist/esm/icons/list.mjs';
import ListCheck from 'lucide/dist/esm/icons/list-check.mjs';
import Lock from 'lucide/dist/esm/icons/lock.mjs';
import LogIn from 'lucide/dist/esm/icons/log-in.mjs';
import Luggage from 'lucide/dist/esm/icons/luggage.mjs';
import Menu from 'lucide/dist/esm/icons/menu.mjs';
import MessageSquare from 'lucide/dist/esm/icons/message-square.mjs';
import PackageOpen from 'lucide/dist/esm/icons/package-open.mjs';
import Palette from 'lucide/dist/esm/icons/palette.mjs';
import Pen from 'lucide/dist/esm/icons/pen.mjs';
import Play from 'lucide/dist/esm/icons/play.mjs';
import Plus from 'lucide/dist/esm/icons/plus.mjs';
import Receipt from 'lucide/dist/esm/icons/receipt.mjs';
import Road from 'lucide/dist/esm/icons/road.mjs';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.mjs';
import RotateCw from 'lucide/dist/esm/icons/rotate-cw.mjs';
import Scissors from 'lucide/dist/esm/icons/scissors.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import Shirt from 'lucide/dist/esm/icons/shirt.mjs';
import ShoppingBag from 'lucide/dist/esm/icons/shopping-bag.mjs';
import ShoppingBasket from 'lucide/dist/esm/icons/shopping-basket.mjs';
import Signpost from 'lucide/dist/esm/icons/signpost.mjs';
import Skull from 'lucide/dist/esm/icons/skull.mjs';
import SprayCan from 'lucide/dist/esm/icons/spray-can.mjs';
import Stethoscope from 'lucide/dist/esm/icons/stethoscope.mjs';
import Syringe from 'lucide/dist/esm/icons/syringe.mjs';
import Tag from 'lucide/dist/esm/icons/tag.mjs';
import Tent from 'lucide/dist/esm/icons/tent.mjs';
import Timer from 'lucide/dist/esm/icons/timer.mjs';
import ToggleRight from 'lucide/dist/esm/icons/toggle-right.mjs';
import Trash from 'lucide/dist/esm/icons/trash.mjs';
import Trash2 from 'lucide/dist/esm/icons/trash-2.mjs';
import TriangleAlert from 'lucide/dist/esm/icons/triangle-alert.mjs';
import Truck from 'lucide/dist/esm/icons/truck.mjs';
import User from 'lucide/dist/esm/icons/user.mjs';
import UserLock from 'lucide/dist/esm/icons/user-lock.mjs';
import UserPen from 'lucide/dist/esm/icons/user-pen.mjs';
import Users from 'lucide/dist/esm/icons/users.mjs';
import UserShield from 'lucide/dist/esm/icons/user-shield.mjs';
import Utensils from 'lucide/dist/esm/icons/utensils.mjs';
import VenetianMask from 'lucide/dist/esm/icons/venetian-mask.mjs';
import Warehouse from 'lucide/dist/esm/icons/warehouse.mjs';
import Wrench from 'lucide/dist/esm/icons/wrench.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';
import Zap from 'lucide/dist/esm/icons/zap.mjs';

/**
 * A Lucide icon is a list of SVG elements, not a single path.
 *
 * FontAwesome icons were one filled path, which is why the old helper could return a lone
 * `d` string. Lucide is stroked geometry — `path`, `circle`, `line`, `rect` — over a 24
 * unit box with `fill: none` and `stroke: currentColor`. Anything drawing these has to
 * iterate, and has to colour them through `stroke` rather than `fill`.
 *
 * Declared here rather than imported so nothing depends on lucide's internal type paths.
 */
export type IconNode = [tag: string, attrs: Record<string, string | number>][];

/** The 24-unit box every Lucide icon is drawn in. */
export const ICON_VIEWBOX = 24;

/** Attributes that make stroked geometry render correctly wherever it is placed. */
export const ICON_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

/** Shown in place of an unresolved name during development. */
export const PLACEHOLDER: IconNode = CircleHelp;

const ICONS: Record<string, IconNode> = {
  // -- Names that arrive from Lua ------------------------------------------------------
  'address-book': BookUser,
  'angle-left': ChevronLeft,
  bag: ShoppingBag,
  bandage: Bandage,
  bell: Bell,
  bolt: Zap,
  bong: Cigarette,
  book: Book,
  'box-archive': Archive,
  'box-open': PackageOpen,
  briefcase: Briefcase,
  'building-columns': Landmark,
  calculator: Calculator,
  'calendar-days': CalendarDays,
  campground: Tent,
  cannabis: Cannabis,
  car: Car,
  'car-battery': BatteryCharging,
  'car-burst': RotateCcw,
  'car-rear': CarFront,
  'car-side': Car,
  'caret-up': ChevronUp,
  chair: Armchair,
  child: Baby,
  circle: Circle,
  'circle-check': CircleCheck,
  'circle-chevron-left': CircleChevronLeft,
  'circle-exclamation': CircleAlert,
  'circle-info': Info,
  'circle-user': CircleUser,
  'circle-xmark': CircleX,
  cloud: Cloud,
  'cloud-arrow-up': CloudUpload,
  cube: Box,
  droplet: Droplet,
  dumpster: Trash2,
  'ear-deaf': EarOff,
  'exclamation-triangle': TriangleAlert,
  eye: Eye,
  'eye-slash': EyeOff,
  'gas-pump': Fuel,
  glasses: Glasses,
  globe: Globe,
  handcuffs: Link,
  'hat-cowboy-side': HardHat,
  'heart-pulse': HeartPulse,
  'hourglass-half': Hourglass,
  'hourglass-start': Hourglass,
  'id-card': IdCard,
  key: Key,
  lightbulb: Lightbulb,
  'list-check': ListCheck,
  'magnifying-glass': Search,
  male: User,
  mask: VenetianMask,
  'masks-theater': Drama,
  message: MessageSquare,
  mitten: Hand,
  'money-bill': Banknote,
  pen: Pen,
  play: Play,
  plus: Plus,
  'rectangle-list': List,
  road: Road,
  scalpel: Syringe,
  scissors: Scissors,
  shirt: Shirt,
  'shoe-prints': Footprints,
  'shopping-basket': ShoppingBasket,
  'sign-hanging': Signpost,
  'sign-in-alt': LogIn,
  'skull-crossbones': Skull,
  stopwatch: Timer,
  taxi: CarTaxiFront,
  'toggle-on': ToggleRight,
  'torii-gate': Fence,
  trash: Trash,
  'triangle-exclamation': TriangleAlert,
  'truck-pickup': Truck,
  'truck-ramp-box': Truck,
  tshirt: Shirt,
  user: User,
  'user-doctor': Stethoscope,
  'user-group': Users,
  'user-lock': UserLock,
  'user-pen': UserPen,
  'user-shield': UserShield,
  'user-tie': Briefcase,
  utensils: Utensils,
  vest: Shirt,
  warehouse: Warehouse,
  wrench: Wrench,

  // -- Names used by ox_lib's and ox_target's own components and dev harness ------------
  bars: Menu,
  'basket-shopping': ShoppingBasket,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'door-open': DoorOpen,
  ellipsis: Ellipsis,
  // The radial menu's "More" entry.
  'ellipsis-h': Ellipsis,
  heart: Heart,
  inbox: Inbox,
  lock: Lock,
  microchip: Cpu,
  'oil-can': Fuel,
  palette: Palette,
  receipt: Receipt,
  rotate: RotateCw,
  screwdriver: Wrench,
  soap: SprayCan,
  suitcase: Luggage,
  tag: Tag,
  xmark: X,
};

/** FontAwesome style tokens, dropped during normalisation. */
const STYLE_TOKENS = new Set([
  'fa',
  'fas',
  'far',
  'fab',
  'fal',
  'fad',
  'fat',
  'fa-solid',
  'fa-regular',
  'fa-brands',
  'fa-light',
  'fa-duotone',
  'fa-thin',
  'fa-sharp',
]);

/**
 * Sizing, animation and layout classes that are never the icon's name.
 *
 * ox_target's icon API is a class string rather than a name, so a consumer can legitimately
 * write `'fa-solid fa-car fa-2x'`. Without this the trailing modifier would be taken for
 * the icon.
 */
const MODIFIER_TOKENS = new Set([
  'fa-fw',
  'fa-2xs',
  'fa-xs',
  'fa-sm',
  'fa-lg',
  'fa-xl',
  'fa-2xl',
  'fa-1x',
  'fa-2x',
  'fa-3x',
  'fa-4x',
  'fa-5x',
  'fa-6x',
  'fa-7x',
  'fa-8x',
  'fa-9x',
  'fa-10x',
  'fa-spin',
  'fa-spin-pulse',
  'fa-spin-reverse',
  'fa-pulse',
  'fa-beat',
  'fa-fade',
  'fa-beat-fade',
  'fa-bounce',
  'fa-shake',
  'fa-flip',
  'fa-flip-horizontal',
  'fa-flip-vertical',
  'fa-flip-both',
  'fa-rotate-90',
  'fa-rotate-180',
  'fa-rotate-270',
  'fa-rotate-by',
  'fa-border',
  'fa-inverse',
  'fa-stack',
  'fa-stack-1x',
  'fa-stack-2x',
  'fa-ul',
  'fa-li',
  'fa-pull-left',
  'fa-pull-right',
]);

/**
 * Reduce any of the accepted shapes to a bare kebab-case name.
 *
 * Accepts the four string forms above, the `{ prefix, iconName }` table ox_lib documents,
 * and the two-element array that table arrives as when Lua sends it positionally.
 */
export function normaliseIconName(value: unknown): string | null {
  if (Array.isArray(value)) {
    // [prefix, name] — the prefix only ever selected a FontAwesome style, which no longer
    // means anything, so only the name is kept.
    return typeof value[1] === 'string' ? normaliseIconName(value[1]) : null;
  }

  if (value && typeof value === 'object') {
    const name = (value as { iconName?: unknown }).iconName;
    return typeof name === 'string' ? normaliseIconName(name) : null;
  }

  if (typeof value !== 'string') return null;

  // First surviving token, not the last. A class string puts modifiers after the name
  // ('fa-solid fa-car fa-2x'), so taking the last would pick up the modifier on anything
  // that carries one.
  const [token] = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part && !STYLE_TOKENS.has(part) && !MODIFIER_TOKENS.has(part));

  if (!token) return null;

  return token.startsWith('fa-') ? token.slice(3) : token;
}

const warned = new Set<string>();

/**
 * Resolve a name to drawable geometry.
 *
 * An unmapped name returns the placeholder in development and null in production. The old
 * behaviour was to return null in both, which is exactly how the class-string bug survived
 * unnoticed — nothing rendered and nothing complained. Production keeps returning null so
 * a missing decorative icon cannot make the UI look broken to a player.
 */
export function resolveIcon(value: unknown): IconNode | null {
  const name = normaliseIconName(value);
  if (!name) return null;

  const node = ICONS[name];
  if (node) return node;

  if (import.meta.env.DEV) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[ox_target] no icon mapped for "${name}" — add it to lib/icons.ts`);
    }

    return PLACEHOLDER;
  }

  return null;
}
