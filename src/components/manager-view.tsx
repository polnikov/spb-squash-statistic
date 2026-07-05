"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Info,
  Plus,
  Search,
  TableProperties,
  Upload,
  Users,
} from "lucide-react";
import {
  type League,
} from "@/lib/mock/league";
import {
  createPlayerAction,
  deleteImportedStageAction,
  deletePointsTableAction,
  importStageAction,
  listImportedStagesAction,
  listPlayerLinkOptionsAction,
  listPointsTablesAction,
  logoutAction,
  previewStageImportAction,
  savePointsTableAction,
  updatePlayerAction,
  type ImportedStage,
  type PlayerLinkOption,
  type PointsTableGroup,
  type StageImportPreview,
  type StageImportSubTournamentSelection,
} from "@/app/(app)/manager/actions";
import { fmtCourt, fmtDate, fmtDateFull, fmtNum, matchesLabel, playersLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import {
  avatarBackgroundStyle,
  fileToDataUrl,
  readPlayerAvatars,
  writePlayerAvatars,
  type PlayerAvatarMedia,
} from "@/lib/player-avatar-store";

type ManagerTab = "players" | "upload" | "points";
type UploadStep = "input" | "preview" | "done";

const MANAGER_TABS: { key: ManagerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "players", label: "Игроки", icon: Users },
  { key: "upload", label: "Загрузка этапа", icon: Upload },
  { key: "points", label: "Таблицы очков", icon: TableProperties },
];

const DIVISIONS = [1, 2, 3] as const;
const PLAYER_PAGE_SIZE = 15;


function ManagerTabs({ tab, setTab }: { tab: ManagerTab; setTab: (tab: ManagerTab) => void }) {
  const { setRef, ind } = useTabSlider(tab);
  return (
    <div className="relative inline-flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1">
      <TabSliderPill ind={ind} />
      {MANAGER_TABS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            ref={setRef(item.key)}
            onClick={() => setTab(item.key)}
            className={cn(
              "relative z-10 inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
              tab === item.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-on-surface-variant">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-3.5 font-mono text-[13px] tabular text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/55 focus:border-primary"
      />
    </label>
  );
}

function DesktopOnlyNotice() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center md:hidden">
      <div className="rounded-2xl bg-card p-5 text-center">
        <div className="text-sm font-semibold">Администрирование доступно только на десктопе</div>
        <div className="mt-1 text-xs text-on-surface-variant">Откройте /manager на большом экране.</div>
      </div>
    </div>
  );
}

function surnameSortKey(name: string) {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const surname = parts.at(-1) ?? "";
  return `${surname} ${parts.join(" ")}`;
}

function PlayersManager({ league }: { league: League }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(PLAYER_PAGE_SIZE);
  const [editingRid, setEditingRid] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newRid, setNewRid] = React.useState("");
  const [newLinkPlayerId, setNewLinkPlayerId] = React.useState("");
  const [createSaving, setCreateSaving] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [avatars, setAvatars] = React.useState<Record<string, PlayerAvatarMedia>>({});
  const [linkOptions, setLinkOptions] = React.useState<PlayerLinkOption[]>([]);
  const [playerEdits, setPlayerEdits] = React.useState<Record<string, { rankedinId: string; adminName: string; rank: string }>>(() =>
    Object.fromEntries(
      league.players.map((player) => [
        player.rid,
        {
          rankedinId: player.rid,
          adminName: player.adminName ?? "",
          rank: String(player.rank),
        },
      ]),
    ),
  );
  const rows = React.useMemo(
    () => {
      const q = query.trim().toLowerCase();
      return [...league.players]
        .sort((a, b) => {
          const aName = playerEdits[a.rid]?.adminName.trim() || a.rankedinName;
          const bName = playerEdits[b.rid]?.adminName.trim() || b.rankedinName;
          return surnameSortKey(aName).localeCompare(surnameSortKey(bName), "ru");
        })
        .filter((player) => {
          if (!q) return true;
          const edit = playerEdits[player.rid];
          const adminName = edit?.adminName.trim() ?? "";
          const displayName = adminName || player.rankedinName;
          const rankedinId = edit?.rankedinId || player.rid;
          return [displayName, adminName, player.rankedinName, rankedinId, player.rid]
            .some((value) => value.toLowerCase().includes(q));
        });
    },
    [league, playerEdits, query],
  );
  const visibleRows = rows.slice(0, visibleCount);
  const moreCount = Math.max(0, rows.length - visibleRows.length);
  const editingPlayer = editingRid ? league.players.find((player) => player.rid === editingRid) : null;
  const editingDraft = editingPlayer ? playerEdits[editingPlayer.rid] : null;
  const editingAvatar = editingPlayer ? avatars[editingPlayer.rid] : undefined;

  React.useEffect(() => {
    setVisibleCount(PLAYER_PAGE_SIZE);
  }, [query]);

  React.useEffect(() => {
    setAvatars(readPlayerAvatars());
    void listPlayerLinkOptionsAction().then(setLinkOptions);
  }, []);

  function patchPlayer(rid: string, patch: Partial<{ rankedinId: string; adminName: string; rank: string }>) {
    setPlayerEdits((current) => ({
      ...current,
      [rid]: {
        rankedinId: current[rid]?.rankedinId ?? rid,
        adminName: current[rid]?.adminName ?? "",
        rank: current[rid]?.rank ?? "",
        ...patch,
      },
    }));
  }

  async function setAvatar(rid: string, file: File) {
    const dataUrl = await fileToDataUrl(file);
    setAvatars((current) => {
      const next = {
        ...current,
        [rid]: { dataUrl, fileName: file.name, scale: 120, x: 0, y: 0 },
      };
      writePlayerAvatars(next);
      return next;
    });
  }

  function patchAvatar(rid: string, patch: Partial<PlayerAvatarMedia>) {
    setAvatars((current) => {
      const existing = current[rid];
      if (!existing) return current;
      const next = { ...current, [rid]: { ...existing, ...patch } };
      writePlayerAvatars(next);
      return next;
    });
  }

  async function savePlayer() {
    if (!editingPlayer || !editingDraft) return;
    setSaving(true);
    setSaveError(null);
    const res = await updatePlayerAction({
      lookupRankedinId: editingPlayer.rid,
      adminName: editingDraft.adminName,
      rankedinId: editingDraft.rankedinId,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error ?? "Ошибка сохранения");
      return;
    }
    setEditingRid(null);
    router.refresh();
  }

  function openCreate() {
    setNewName("");
    setNewRid("");
    setNewLinkPlayerId("");
    setCreateError(null);
    setCreating(true);
  }

  async function saveNewPlayer() {
    setCreateSaving(true);
    setCreateError(null);
    const linkToPlayerId = parseOptionalInt(newLinkPlayerId);
    const linkedPlayer = linkOptions.find((player) => player.playerId === linkToPlayerId);
    const name = newName.trim() || linkedPlayer?.rankedinName || linkedPlayer?.name || "";
    const res = await createPlayerAction({ name, rankedinId: newRid, linkToPlayerId });
    setCreateSaving(false);
    if (!res.ok) {
      setCreateError(res.error ?? "Ошибка создания");
      return;
    }
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex max-w-[1320px] flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Администрирование</h1>
        <button
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-primary px-4 text-[13px] font-semibold text-on-primary"
        >
          <Plus className="size-4" />
          Новый игрок
        </button>
      </div>

      {creating ? (
        <div
          className="animate-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setCreating(false)}
        >
          <div
            className="animate-modal-panel w-full max-w-[440px] rounded-2xl bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Новый игрок</h2>
              <button
                onClick={() => setCreating(false)}
                aria-label="Закрыть"
                className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <Field
                label="Имя RankedIn"
                value={newName}
                onChange={setNewName}
                placeholder="Иван Иванов"
              />
              <Field
                label="RankedIn ID"
                value={newRid}
                onChange={setNewRid}
                placeholder="R000041702"
              />
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-on-surface-variant">Связать с существующим игроком</span>
                <FilterDropdown
                  value={newLinkPlayerId}
                  onChange={setNewLinkPlayerId}
                  allLabel="Не связывать, создать нового"
                  options={linkOptions.map((player) => ({
                    value: String(player.playerId),
                    label: `${player.name} · ${player.rankedinId ?? "без ID"}`,
                  }))}
                  sizeClass="h-11 rounded-[12px] px-3.5 text-[13px]"
                />
                <span className="text-[10.5px] leading-snug text-on-surface-variant">
                  Если выбран игрок, новый RankedIn ID станет текущим, прежний ID сохранится как alias.
                </span>
              </label>

              {createError ? (
                <div className="rounded-[12px] bg-error-container px-3.5 py-2.5 text-xs font-medium text-on-error-container">
                  {createError}
                </div>
              ) : null}

              <div className="mt-1 flex justify-end gap-3">
                <button
                  onClick={() => setCreating(false)}
                  className="h-11 rounded-[12px] border border-outline-variant px-5 text-[13px] font-semibold text-on-surface-variant"
                >
                  Отмена
                </button>
                <button
                  onClick={saveNewPlayer}
                  disabled={createSaving || !newRid.trim() || (!newName.trim() && !newLinkPlayerId)}
                  className="h-11 rounded-[12px] bg-primary px-5 text-[13px] font-semibold text-on-primary disabled:opacity-60"
                >
                  {createSaving ? "Сохранение…" : newLinkPlayerId ? "Связать ID" : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <label className="relative block w-full max-w-[420px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или ID..."
            className="h-11 w-full rounded-[14px] border border-outline-variant bg-surface-container-low py-2 pl-10 pr-3.5 text-[13px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/55 focus:border-primary"
          />
        </label>
        <div className="whitespace-nowrap text-xs text-on-surface-variant">
          {rows.length} из {league.players.length}
        </div>
      </div>

      {editingPlayer && editingDraft ? (
        <div
          className="animate-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setEditingRid(null)}
        >
          <div
            className="animate-modal-panel w-full max-w-[440px] rounded-2xl bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">{editingPlayer.rankedinName}</h2>
              <button
                onClick={() => setEditingRid(null)}
                aria-label="Закрыть"
                className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {/* avatar */}
              <div className="flex flex-col items-center gap-3">
                <span
                  className="flex size-[216px] shrink-0 items-center justify-center rounded-full bg-surface-container-high bg-cover bg-center text-5xl font-semibold text-white ring-1 ring-outline-variant"
                  style={editingAvatar ? avatarBackgroundStyle(editingAvatar) : { background: editingPlayer.color }}
                >
                  {editingAvatar ? null : editingPlayer.initials}
                </span>
                <label className="group inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-surface-container-high px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
                  <Upload className="size-3.5" />
                  Загрузить фото
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setAvatar(editingPlayer.rid, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {editingAvatar ? (
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["Масштаб", "scale", 80, 220],
                    ["X", "x", -50, 50],
                    ["Y", "y", -50, 50],
                  ] as const).map(([label, key, min, max]) => (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-on-surface-variant">{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={editingAvatar[key]}
                        onChange={(event) => patchAvatar(editingPlayer.rid, { [key]: Number(event.target.value) })}
                        className="w-full accent-primary"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              <Field
                label="RankedIn ID"
                value={editingDraft.rankedinId}
                onChange={(value) => patchPlayer(editingPlayer.rid, { rankedinId: value })}
                placeholder="R000041702"
              />
              <Field
                label="Имя в приложении"
                value={editingDraft.adminName}
                onChange={(value) => patchPlayer(editingPlayer.rid, { adminName: value })}
                placeholder={editingPlayer.rankedinName}
              />

              {saveError ? (
                <div className="rounded-[12px] bg-error-container px-3.5 py-2.5 text-xs font-medium text-on-error-container">
                  {saveError}
                </div>
              ) : null}

              <div className="mt-1 flex justify-end gap-3">
                <button
                  onClick={() => setEditingRid(null)}
                  className="h-11 rounded-[12px] border border-outline-variant px-5 text-[13px] font-semibold text-on-surface-variant"
                >
                  Отмена
                </button>
                <button
                  onClick={savePlayer}
                  disabled={saving}
                  className="h-11 rounded-[12px] bg-primary px-5 text-[13px] font-semibold text-on-primary disabled:opacity-60"
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-brand-surface-2/60 text-center text-[11px] text-muted-foreground">
                <th className="px-3 py-3 font-medium">Имя RankedIn</th>
                <th className="px-3 py-3 font-medium">Имя в приложении</th>
                <th className="px-3 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Рейтинг</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((player) => {
                const edit = playerEdits[player.rid];
                const adminName = edit?.adminName ?? "";
                const displayName = adminName.trim() || player.rankedinName;
                const rankedinId = edit?.rankedinId || player.rid;
                const rank = Number(edit?.rank);
                const avatar = avatars[player.rid];
                return (
                  <tr key={player.rid} className="border-t border-outline-variant transition-colors hover:bg-surface-container-high/35">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cover bg-center text-xs font-semibold text-white"
                          style={avatar ? avatarBackgroundStyle(avatar) : { background: player.color }}
                        >
                          {avatar ? null : player.initials}
                        </span>
                        <div>
                          <div className="text-[13.5px] font-[550]">{player.rankedinName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className={cn("text-[13px] font-medium", adminName.trim() ? "text-on-surface" : "text-on-surface-variant")}>
                        {adminName.trim() ? displayName : "Не задано"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular text-on-surface-variant">{rankedinId}</td>
                    <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular">{fmtNum(Number.isFinite(rank) ? rank : player.rank)}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => setEditingRid(player.rid)}
                        className="inline-flex items-center gap-1.5 rounded-[10px] bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                      >
                        <Edit3 className="size-3.5" />
                        Изменить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr className="border-t border-outline-variant">
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-on-surface-variant">
                    Игроки не найдены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {moreCount > 0 ? (
          <button
            onClick={() => setVisibleCount((current) => current + PLAYER_PAGE_SIZE)}
            className="w-full border-t border-outline-variant bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
          >
            Показать еще {Math.min(PLAYER_PAGE_SIZE, moreCount)}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DivisionPicker({ value, onChange }: { value: 1 | 2 | 3; onChange: (value: 1 | 2 | 3) => void }) {
  const { setRef, ind } = useTabSlider(String(value));
  return (
    <div className="relative flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1">
      <TabSliderPill ind={ind} />
      {DIVISIONS.map((division) => (
        <button
          key={division}
          ref={setRef(String(division))}
          onClick={() => onChange(division)}
          className={cn(
            "relative z-10 h-9 flex-1 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            value === division ? "text-on-surface" : "text-on-surface-variant",
          )}
        >
          {division}
        </button>
      ))}
    </div>
  );
}

function UploadStepper({ step }: { step: UploadStep }) {
  const steps: { key: UploadStep; label: string }[] = [
    { key: "input", label: "Параметры" },
    { key: "preview", label: "Предпросмотр" },
    { key: "done", label: "Готово" },
  ];
  const current = steps.findIndex((item) => item.key === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((item, index) => (
        <React.Fragment key={item.key}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-[26px] items-center justify-center rounded-full font-mono text-xs font-semibold tabular",
                index <= current ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
              )}
            >
              {index + 1}
            </span>
            <span className={cn("text-[12.5px] font-medium", index <= current ? "text-on-surface" : "text-on-surface-variant")}>
              {item.label}
            </span>
          </div>
          {index < steps.length - 1 ? <span className="h-0.5 w-7 rounded-full bg-outline-variant" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function parseOptionalInt(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function previewValue(value: number | string | null | undefined) {
  return value === null || value === undefined || value === "" ? "x" : value;
}

function PreviewStatus({ row }: { row: StageImportPreview["players"][number] }) {
  if (row.excludedFromImport) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="rounded-full bg-error-container px-2.5 py-1 text-[11px] font-semibold text-on-error-container">не загружается</span>
        <span className="text-[10.5px] text-on-surface-variant">{row.excludeReason}</span>
      </div>
    );
  }
  if (row.status === "conflict") {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="rounded-full bg-error-container px-2.5 py-1 text-[11px] font-semibold text-on-error-container">конфликт ID</span>
        <span className="text-[10.5px] text-on-surface-variant">{row.conflictReason}</span>
      </div>
    );
  }
  if (row.status === "new") {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="rounded-full bg-[#2563eb]/15 px-2.5 py-1 text-[11px] font-semibold text-[#93c5fd]">новый ID</span>
        {row.possibleMatches?.length ? <span className="text-[10.5px] text-on-surface-variant">есть совпадение по имени</span> : null}
      </div>
    );
  }
  return <span className="rounded-full bg-[#16a34a]/15 px-2.5 py-1 text-[11px] font-semibold text-[#86efac]">совпадает</span>;
}

/** Accordion-style player link picker (app-styled), shown to the right of the
 * status chip. Replaces the native <select> so the reveal animates and the
 * options match the app surface/typography. */
function LinkPicker({
  value,
  possibleOptions,
  otherOptions,
  onSelect,
}: {
  value: string;
  possibleOptions: PlayerLinkOption[];
  otherOptions: PlayerLinkOption[];
  onSelect: (playerId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const all = [...possibleOptions, ...otherOptions];
  const selected = all.find((p) => String(p.playerId) === value);
  const label = selected ? selected.name : "Новый отдельный игрок";

  function pick(playerId: string) {
    onSelect(playerId);
    setOpen(false);
  }

  const Option = ({ player }: { player: PlayerLinkOption }) => (
    <button
      type="button"
      onClick={() => pick(String(player.playerId))}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-left transition-colors duration-150 ease-m3-standard hover:bg-surface-container-highest",
        String(player.playerId) === value && "bg-primary/12",
      )}
    >
      <span className="truncate text-[11.5px] text-on-surface">{player.name}</span>
      <span className="shrink-0 font-mono text-[11px] tabular text-on-surface-variant">{player.rankedinId ?? "без ID"}</span>
    </button>
  );

  return (
    <div className="w-[220px] text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border border-outline-variant bg-surface-container-low px-2.5 text-[11.5px] text-on-surface outline-none transition-colors duration-200 ease-m3-standard hover:border-primary/60 focus:border-primary"
      >
        <span className={cn("truncate", !selected && "text-on-surface-variant")}>{label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-on-surface-variant transition-transform duration-300 ease-m3-emphasized-decel", open && "rotate-180")} />
      </button>

      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="mt-1 max-h-[240px] space-y-0.5 overflow-y-auto rounded-[10px] border border-outline-variant bg-surface-container-low p-1.5 shadow-e2">
            <button
              type="button"
              onClick={() => pick("")}
              className={cn(
                "flex w-full items-center rounded-[8px] px-2.5 py-1.5 text-left text-[11.5px] transition-colors duration-150 ease-m3-standard hover:bg-surface-container-highest",
                !value ? "bg-primary/12 text-primary" : "text-on-surface",
              )}
            >
              Новый отдельный игрок
            </button>
            {possibleOptions.length > 0 ? (
              <>
                <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Совпадение по имени</div>
                {possibleOptions.map((player) => (
                  <Option key={player.playerId} player={player} />
                ))}
              </>
            ) : null}
            <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Все игроки</div>
            {otherOptions.map((player) => (
              <Option key={player.playerId} player={player} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** App-styled filter dropdown with a Transitions.dev accordion-expand panel
 * (grid-template-rows 0fr -> 1fr). Overlays via absolute positioning. */
function FilterDropdown({
  value,
  options,
  allLabel,
  onChange,
  className,
  sizeClass,
}: {
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
  onChange: (value: string) => void;
  className?: string;
  sizeClass?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const sel = options.find((o) => o.value === value);
  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }
  const item = (v: string, label: string) => (
    <button
      key={v || "__all"}
      type="button"
      onClick={() => pick(v)}
      className={cn(
        "block w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12px] transition-colors duration-150 ease-m3-standard hover:bg-surface-container-highest",
        v === value ? "font-semibold text-primary" : "text-on-surface",
      )}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-outline-variant bg-surface-container-low text-on-surface outline-none transition-colors duration-200 ease-m3-standard hover:border-primary/60 focus:border-primary",
          sizeClass ?? "h-8 rounded-[10px] px-2.5 text-[12px]",
        )}
      >
        <span className={cn("truncate", !sel && "text-on-surface-variant")}>{sel ? sel.label : allLabel}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-on-surface-variant transition-transform duration-300 ease-m3-emphasized-decel", open && "rotate-180")} />
      </button>

      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+6px)] z-30 grid w-full min-w-[150px] transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel",
          open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-[10px] shadow-e2">
          <div className="max-h-[240px] space-y-0.5 overflow-y-auto rounded-[10px] border border-outline-variant bg-surface-container-low p-1.5">
            {item("", allLabel)}
            {options.map((o) => item(o.value, o.label))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadManager() {
  const router = useRouter();
  const [step, setStep] = React.useState<UploadStep>("input");
  const [tournament, setTournament] = React.useState("");
  // Optional overrides; left empty so the script infers season/division/stage.
  const [season, setSeason] = React.useState("");
  const [division, setDivision] = React.useState("");
  const [stage, setStage] = React.useState("");
  const [date, setDate] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [preview, setPreview] = React.useState<StageImportPreview | null>(null);
  const [subtournaments, setSubtournaments] = React.useState<StageImportSubTournamentSelection | null>(null);
  const [selectedClassId, setSelectedClassId] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ players: number; matches: number; season: string; division: number; stage: number; date: string } | null>(null);
  const [imported, setImported] = React.useState<ImportedStage[]>([]);
  const [delKey, setDelKey] = React.useState<string | null>(null);
  const [linkOptions, setLinkOptions] = React.useState<PlayerLinkOption[]>([]);
  const [playerLinks, setPlayerLinks] = React.useState<Record<string, string>>({});
  const [impExpanded, setImpExpanded] = React.useState(false);
  const [impSeason, setImpSeason] = React.useState("");
  const [impDiv, setImpDiv] = React.useState("");

  const refreshImported = React.useCallback(async () => {
    setImported(await listImportedStagesAction());
  }, []);
  React.useEffect(() => {
    void refreshImported();
    void listPlayerLinkOptionsAction().then(setLinkOptions);
  }, [refreshImported]);

  function setPlayerLink(rankedinId: string, playerId: string) {
    setPlayerLinks((current) => {
      const next = { ...current };
      if (playerId) next[rankedinId] = playerId;
      else delete next[rankedinId];
      return next;
    });
  }

  async function deleteImported(s: ImportedStage) {
    const key = `${s.season}-${s.division}-${s.stage}`;
    setDelKey(key);
    await deleteImportedStageAction({ season: s.season, division: s.division, stage: s.stage });
    setDelKey(null);
    await refreshImported();
    router.refresh();
  }

  const importInput = React.useMemo(
    () => ({
      tournament,
      season: season.trim() || undefined,
      division: parseOptionalInt(division),
      stage: parseOptionalInt(stage),
      date: date || undefined,
    }),
    [date, division, season, stage, tournament],
  );

  async function runParse(classId?: string) {
    setParsing(true);
    setError(null);
    const res = await previewStageImportAction({ ...importInput, classId });
    setParsing(false);
    if (!res.ok) {
      setSubtournaments(null);
      setError(res.error);
      return;
    }
    if (res.kind === "subtournaments") {
      setSubtournaments(res.subtournaments);
      setSelectedClassId(undefined);
      setPreview(null);
      return;
    }
    setPreview(res.preview);
    setSubtournaments(null);
    setSelectedClassId(res.preview.selectedSubTournament?.id);
    setPlayerLinks({});
    setSeason(res.preview.season);
    setDivision(String(res.preview.division));
    setStage(String(res.preview.stage));
    setDate(res.preview.date);
    setStep("preview");
  }

  async function commitImport() {
    if (!preview || preview.conflicts > 0 || preview.alreadyImported) return;
    setImporting(true);
    setError(null);
    const res = await importStageAction({
      tournament,
      classId: selectedClassId ?? preview.selectedSubTournament?.id,
      season: preview.season,
      division: preview.division,
      stage: preview.stage,
      date: preview.date || undefined,
      playerLinks: Object.entries(playerLinks)
        .map(([rankedinId, playerId]) => ({ rankedinId, playerId: Number(playerId) }))
        .filter((link) => Number.isInteger(link.playerId) && link.playerId > 0),
    });
    setImporting(false);
    if (!res?.ok) {
      setError(res?.error ?? "Не удалось загрузить. Повторите.");
      return;
    }
    setDone({ ...res, date: preview.date });
    setStep("done");
    await refreshImported();
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-5">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Загрузка этапа</h1>
      <UploadStepper step={step} />

      {subtournaments ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-[560px] rounded-[20px] border border-outline-variant bg-card p-5 shadow-e3">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Выберите подтурнир</h2>
                <p className="mt-1 text-xs text-on-surface-variant">{subtournaments.tournamentName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubtournaments(null)}
                className="rounded-[10px] px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-high"
              >
                Отмена
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {subtournaments.options.map((option) => (
                <button
                  key={option.id || option.name}
                  type="button"
                  onClick={() => runParse(option.id)}
                  disabled={parsing}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] border border-outline-variant bg-surface-container-low px-4 py-3 text-left transition-colors duration-200 ease-m3-standard hover:border-primary/70 hover:bg-surface-container-high disabled:opacity-60"
                >
                  <span className="text-[13px] font-semibold text-on-surface">{option.name || `Подтурнир ${option.id}`}</span>
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-[11px] tabular text-on-surface-variant">{option.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === "input" ? (
        <div className="grid grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-6">
          {/* left: form */}
          <div className="flex h-fit flex-col gap-5 rounded-2xl bg-card p-6">
            <Field label="ID или ссылка турнира" value={tournament} onChange={setTournament} placeholder="84213 или https://www.rankedin.com/..." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сезон" value={season} onChange={setSeason} placeholder="25/26" />
              <Field label="Дивизион" value={division} onChange={setDivision} placeholder="1" />
              <Field label="Этап" value={stage} onChange={setStage} placeholder="7" />
              <Field label="Дата" value={date} onChange={setDate} type="date" />
            </div>
            <div className="flex items-start gap-3 rounded-[14px] bg-surface-container-high px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
              <span className="text-xs text-on-surface-variant">
                Скрипт получает результаты по турниру и список матчей турнира из RankedIn.
              </span>
            </div>
            {error ? (
              <div className="rounded-[12px] bg-error-container px-3.5 py-2.5 text-xs font-medium text-on-error-container">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end">
              <button
                onClick={() => runParse()}
                disabled={parsing || !tournament.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-primary px-5 text-[13.5px] font-semibold text-on-primary disabled:opacity-60"
              >
                {parsing ? "Загрузка…" : "Подгрузить данные"}
              </button>
            </div>
          </div>

          {/* right: imported stages */}
          {(() => {
            const importedRows = imported ?? [];
            const impSeasons = [...new Set(importedRows.map((s) => s.season))].sort().reverse();
            const impDivs = [...new Set(importedRows.map((s) => s.division))].sort((a, b) => a - b);
            const filtered = importedRows.filter(
              (s) => (impSeason === "" || s.season === impSeason) && (impDiv === "" || String(s.division) === impDiv),
            );
            const impFirst = filtered.slice(0, 9);
            const impRest = filtered.slice(9);
            const renderImp = (s: ImportedStage) => {
              const key = `${s.season}-${s.division}-${s.stage}`;
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-container-low px-3.5 py-2.5">
                  <div className="text-[13px]">
                    <span className="font-semibold">{s.season} · Див {s.division} · Этап {s.stage}</span>
                    <span className="ml-2 font-mono text-[11.5px] tabular text-on-surface-variant">
                      {playersLabel(s.players)} · {matchesLabel(s.matches)}{s.date ? ` · ${fmtDateFull(s.date)}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteImported(s)}
                    disabled={delKey === key}
                    className="rounded-[10px] px-3 py-1.5 text-[11.5px] font-semibold text-error hover:bg-error-container/40 disabled:opacity-60"
                  >
                    {delKey === key ? "…" : "Удалить"}
                  </button>
                </div>
              );
            };
            return (
              <div className="flex h-fit flex-col gap-2 rounded-2xl bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Загруженные этапы</div>
                  <div className="ml-auto flex items-center gap-2">
                    <FilterDropdown
                      value={impSeason}
                      onChange={setImpSeason}
                      allLabel="Все сезоны"
                      options={impSeasons.map((s) => ({ value: s, label: s }))}
                      className="w-[120px]"
                    />
                    <FilterDropdown
                      value={impDiv}
                      onChange={setImpDiv}
                      allLabel="Все дивизионы"
                      options={impDivs.map((d) => ({ value: String(d), label: `Див ${d}` }))}
                      className="w-[140px]"
                    />
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <div className="py-3 text-center text-xs text-on-surface-variant">Нет загруженных этапов</div>
                ) : (
                  <>
                    {impFirst.map(renderImp)}
                    {impRest.length > 0 ? (
                      <>
                        {/* extra rows reveal via accordion expand (grid-rows 0fr -> 1fr) */}
                        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", impExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                          <div className="min-h-0 overflow-hidden">
                            <div className="flex flex-col gap-2">{impRest.map(renderImp)}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setImpExpanded((v) => !v)}
                          className="mt-1 w-full rounded-lg bg-surface-container-high py-2.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                        >
                          {impExpanded ? "Свернуть" : `Показать ещё ${impRest.length}`}
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="flex flex-col gap-4">
          {preview.alreadyImported ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-error-container px-4 py-3 text-on-error-container">
              <Info className="size-4" />
              <span className="text-[13px] font-medium">
                Этап {preview.stage} (дивизион {preview.division}, {preview.season}) уже загружен. Удалите его в списке ниже, чтобы перезагрузить.
              </span>
            </div>
          ) : null}
          {preview.conflicts > 0 ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-error-container px-4 py-3 text-on-error-container">
              <Info className="size-4" />
              <span className="text-[13px] font-medium">Найдены конфликты ID: {preview.conflicts}. Исправьте игроков перед загрузкой.</span>
            </div>
          ) : null}
          {preview.warnings.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-[14px] bg-surface-container-high px-4 py-3 text-xs text-on-surface-variant">
              {preview.warnings.slice(0, 3).map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-[12px] bg-error-container px-3.5 py-2.5 text-xs font-medium text-on-error-container">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Турнир · {preview.tournamentName}</h2>
                <div className="mt-1 text-xs text-on-surface-variant">
                  Сезон {preview.season} · дивизион {preview.division} · этап {preview.stage}{preview.selectedSubTournament ? ` · ${preview.selectedSubTournament.name}` : ""}{preview.date ? ` · ${fmtDateFull(preview.date)}` : ""} · {playersLabel(preview.players.length)} · {matchesLabel(preview.matches.length)}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-surface-2/60 text-center text-[11px] text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Место</th>
                    <th className="px-3 py-3 font-medium">Игрок</th>
                    <th className="px-3 py-3 font-medium">ID</th>
                    <th className="px-3 py-3 font-medium">Skill</th>
                    <th className="px-3 py-3 font-medium">Матчи</th>
                    <th className="px-3 py-3 font-medium">Геймы</th>
                    <th className="px-3 py-3 font-medium">Мячи</th>
                    <th className="px-3 py-3 font-medium">Время на корте</th>
                    <th className="w-px whitespace-nowrap px-5 py-3 font-medium">Статус / связка</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.players.map((row) => {
                    const conflict = row.status === "conflict";
                    const excluded = Boolean(row.excludedFromImport);
                    const selectedLink = playerLinks[row.rankedinId] ?? "";
                    const possibleIds = new Set((row.possibleMatches ?? []).map((player) => player.playerId));
                    const possibleOptions = (row.possibleMatches ?? [])
                      .filter((player) => player.rankedinId !== row.rankedinId);
                    const otherOptions = linkOptions
                      .filter((player) => player.rankedinId !== row.rankedinId && !possibleIds.has(player.playerId));
                    return (
                      <tr
                        key={`${row.rankedinId}-${row.place}`}
                        className={cn("border-t border-outline-variant", conflict && "bg-error-container/45", excluded && "bg-error-container/15")}
                      >
                        <td className={cn("border-l-4 px-5 py-3 font-mono text-[13px] font-semibold tabular", excluded ? "border-error" : "border-transparent")}>{row.place}</td>
                        <td className="px-3 py-3 text-left">
                          <div className="text-[13px] font-[550]">{row.name}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <a
                            href={row.playerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn("font-mono text-[11px] tabular underline-offset-2 hover:underline", conflict ? "text-error" : "text-on-surface-variant hover:text-primary")}
                          >
                            {row.rankedinId}
                          </a>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular text-on-surface-variant">{previewValue(row.ratingBefore)} → {previewValue(row.ratingAfter)}</td>
                        <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular">{previewValue(row.wins)}-{previewValue(row.losses)}</td>
                        <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular text-on-surface-variant">{previewValue(row.wonGames)}-{previewValue(row.lostGames)}</td>
                        <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular text-on-surface-variant">{previewValue(row.wonBalls)}-{previewValue(row.lostBalls)}</td>
                        <td className="px-3 py-3 text-center font-mono text-[12.5px] tabular text-on-surface-variant">{row.courtMinutes === null || row.courtMinutes === undefined ? "x" : fmtCourt(row.courtMinutes)}</td>
                        <td className="w-px whitespace-nowrap px-5 py-3 text-right align-top">
                          <div className="flex flex-col items-end gap-2">
                            <PreviewStatus row={row} />
                            {!excluded && row.status === "new" ? (
                              <LinkPicker
                                value={selectedLink}
                                possibleOptions={possibleOptions}
                                otherOptions={otherOptions}
                                onSelect={(playerId) => setPlayerLink(row.rankedinId, playerId)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setStep("input")} className="h-11 rounded-[12px] border border-outline-variant px-5 text-[13.5px] font-semibold text-on-surface-variant">
              Отклонить
            </button>
            <button
              onClick={commitImport}
              disabled={importing || preview.conflicts > 0 || preview.alreadyImported}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-primary px-5 text-[13.5px] font-semibold text-on-primary disabled:opacity-55"
            >
              <Check className="size-4" />
              {importing ? "Загрузка…" : "Загрузить результаты"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary-container text-[#04A45A]">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-[24px] font-semibold tracking-tight">Этап загружен</h2>
          <p className="whitespace-nowrap text-sm text-on-surface-variant">
            Сезон {done?.season} · дивизион {done?.division} · этап {done?.stage}{done?.date ? ` · ${fmtDateFull(done.date)}` : ""} · игроков: {done?.players} · матчей: {done?.matches}
          </p>
          <button
            onClick={() => {
              setStep("input");
              setTournament("");
              setPreview(null);
              setSubtournaments(null);
              setSelectedClassId(undefined);
              setDone(null);
              setError(null);
            }}
            className="mt-2 h-11 rounded-[12px] bg-primary px-5 text-[13.5px] font-semibold text-on-primary"
          >
            Загрузить еще этап
          </button>
        </div>
      ) : null}
    </div>
  );
}

type PointsRowDraft = { place: string; points: string };

function PointsManager() {
  const router = useRouter();
  const [division, setDivision] = React.useState<1 | 2 | 3>(1);
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [rows, setRows] = React.useState<PointsRowDraft[]>([{ place: "1", points: "" }]);
  const [replaceFrom, setReplaceFrom] = React.useState<string | null>(null);
  const [existing, setExisting] = React.useState<PointsTableGroup[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const refreshExisting = React.useCallback(async () => {
    setExisting(await listPointsTablesAction());
  }, []);

  React.useEffect(() => {
    void refreshExisting();
  }, [refreshExisting]);

  function setRow(index: number, patch: Partial<PointsRowDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((current) => [...current, { place: String(current.length + 1), points: "" }]);
  }
  function removeRow(index: number) {
    setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }
  function resetForm() {
    setDivision(1);
    setEffectiveFrom("");
    setRows([{ place: "1", points: "" }]);
    setReplaceFrom(null);
  }
  function loadForEdit(group: PointsTableGroup) {
    setDivision(group.division as 1 | 2 | 3);
    setEffectiveFrom(group.effectiveFrom);
    setRows(group.rows.map((r) => ({ place: String(r.place), points: String(r.points) })));
    setReplaceFrom(group.effectiveFrom);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    // accept comma decimals like "20,5"
    const parsed = rows
      .map((r) => ({ place: Number(r.place), points: Number(r.points.replace(",", ".")) }))
      .filter((r) => Number.isInteger(r.place) && r.place > 0 && Number.isFinite(r.points) && r.points >= 0);
    const res = await savePointsTableAction({
      division,
      effectiveFrom,
      rows: parsed,
      replaceEffectiveFrom: replaceFrom ?? undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: res.error ?? "Ошибка сохранения" });
      return;
    }
    setMessage({ ok: true, text: replaceFrom ? "Таблица обновлена" : "Таблица сохранена" });
    resetForm();
    await refreshExisting();
    router.refresh();
  }

  async function del(group: PointsTableGroup) {
    const key = `${group.division}-${group.effectiveFrom}`;
    setBusyKey(key);
    await deletePointsTableAction({ division: group.division, effectiveFrom: group.effectiveFrom });
    setBusyKey(null);
    if (replaceFrom === group.effectiveFrom && division === group.division) resetForm();
    await refreshExisting();
    router.refresh();
  }

  return (
    <div className="flex max-w-[1320px] flex-col gap-5">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Таблицы очков</h1>

      <div className="grid grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-6">
        {/* editor */}
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{replaceFrom ? "Изменение таблицы" : "Новая таблица"}</span>
            {replaceFrom ? (
              <button onClick={resetForm} className="text-[11.5px] font-semibold text-on-surface-variant hover:text-on-surface">
                Отмена
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-on-surface-variant">Действует с</span>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className="h-11 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-3.5 text-[13px] text-on-surface outline-none transition-colors focus:border-primary"
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-on-surface-variant">Дивизион</span>
              <DivisionPicker value={division} onChange={setDivision} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Место → очки</span>
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={row.place}
                  onChange={(event) => setRow(index, { place: event.target.value })}
                  placeholder="место"
                  className="h-10 w-20 rounded-[10px] border border-outline-variant bg-surface-container-low px-3 font-mono text-[13px] tabular outline-none focus:border-primary"
                />
                <span className="text-on-surface-variant">→</span>
                <input
                  inputMode="decimal"
                  value={row.points}
                  onChange={(event) => setRow(index, { points: event.target.value })}
                  placeholder="20,5"
                  className="h-10 w-24 rounded-[10px] border border-outline-variant bg-surface-container-low px-3 font-mono text-[13px] tabular outline-none focus:border-primary"
                />
                <button
                  onClick={() => removeRow(index)}
                  className="ml-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  aria-label="Удалить строку"
                >
                  ✕
                </button>
              </div>
            ))}
            <button onClick={addRow} className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-primary hover:underline">
              <Plus className="size-3.5" />
              Добавить строку
            </button>
          </div>

          {message ? (
            <div
              className={cn(
                "rounded-[12px] px-3.5 py-2.5 text-xs font-medium",
                message.ok ? "bg-primary-container text-primary" : "bg-error-container text-on-error-container",
              )}
            >
              {message.text}
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={saving}
            className="h-11 rounded-[12px] bg-primary px-5 text-[13px] font-semibold text-on-primary disabled:opacity-60"
          >
            {saving ? "Сохранение…" : replaceFrom ? "Сохранить изменения" : "Сохранить таблицу"}
          </button>
        </div>

        {/* existing tables */}
        <div className="flex flex-col gap-3">
          {existing.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-sm text-on-surface-variant">
              Нет сохранённых таблиц очков
            </div>
          ) : (
            existing.map((group) => {
              const key = `${group.division}-${group.effectiveFrom}`;
              return (
                <div key={key} className="overflow-hidden rounded-2xl bg-card">
                  <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
                    <div>
                      <div className="text-[13.5px] font-semibold">Дивизион {group.division}</div>
                      <div className="mt-0.5 text-[11.5px] text-on-surface-variant">действует с {fmtDate(group.effectiveFrom)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadForEdit(group)}
                        className="rounded-[10px] bg-surface-container-high px-3 py-1.5 text-[11.5px] font-semibold text-on-surface-variant hover:text-on-surface"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => del(group)}
                        disabled={busyKey === key}
                        className="rounded-[10px] px-3 py-1.5 text-[11.5px] font-semibold text-error hover:bg-error-container/40 disabled:opacity-60"
                      >
                        {busyKey === key ? "…" : "Удалить"}
                      </button>
                    </div>
                  </div>
                  <div className="columns-2 gap-x-6 p-3 sm:columns-3">
                    {group.rows.map((row) => (
                      <div key={row.place} className="flex break-inside-avoid items-center justify-between rounded-[8px] px-2 py-1">
                        <span className="font-mono text-[12px] tabular text-on-surface-variant">{row.place}</span>
                        <span className="font-mono text-[12.5px] font-semibold tabular">{row.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function ManagerView({ league }: { league: League }) {
  const [tab, setTab] = React.useState<ManagerTab>("players");

  return (
    <>
      <DesktopOnlyNotice />
      <div className="hidden flex-col gap-5 px-1 md:flex">
        <div className="flex items-center justify-between">
          <ManagerTabs tab={tab} setTab={setTab} />
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-[10px] px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
            >
              Выйти
            </button>
          </form>
        </div>
        {tab === "players" ? <PlayersManager league={league} /> : null}
        {tab === "upload" ? <UploadManager /> : null}
        {tab === "points" ? <PointsManager /> : null}
      </div>
    </>
  );
}
