'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AutosaveHeader, useAutosave } from '@/components/admin/useAutosave';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WeddingPartyMember {
  id: string;
  name: string;
  role: string;
  relationship: string;
  photo?: string;
  photoAlign?: 'top' | 'top-center' | 'center' | 'center-bottom' | 'bottom';
  bio?: string;
}

interface SortableRowProps {
  member: WeddingPartyMember;
  index: number;
  party: 'bride' | 'groom' | 'somethingBlueCrew';
  onEdit: (party: 'bride' | 'groom' | 'somethingBlueCrew', index: number) => void;
  onDelete: (party: 'bride' | 'groom' | 'somethingBlueCrew', index: number) => void;
}

function SortableRow({ member, index, party, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'bg-gray-50' : ''}>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 focus:outline-none touch-none"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </td>
      <td className="px-3 sm:px-6 py-4">{member.name}</td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">{member.role}</td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">{member.relationship}</td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onEdit(party, index)}
          className="text-blue-100 bg-blue-500 px-3 py-1 rounded hover:bg-blue-600 mr-2 text-sm"
        >
          Изменить
        </button>
        <button
          onClick={() => onDelete(party, index)}
          className="text-red-100 bg-red-500 px-3 py-1 rounded hover:bg-red-600 text-sm"
        >
          Удалить
        </button>
      </td>
    </tr>
  );
}

interface OfficiantInfo {
  name: string;
  relationship: string;
  photo?: string;
  photoAlign?: 'top' | 'top-center' | 'center' | 'center-bottom' | 'bottom';
  bio?: string;
}

interface WeddingPartyData {
  brideParty: WeddingPartyMember[];
  groomParty: WeddingPartyMember[];
  somethingBlueCrew?: WeddingPartyMember[];
  officiant?: OfficiantInfo;
}

export default function AdminWeddingPartyPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [config, setConfig] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingParty, setEditingParty] = useState<'bride' | 'groom' | 'somethingBlueCrew' | 'officiant' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<WeddingPartyMember>({
    id: '',
    name: '',
    role: '',
    relationship: '',
    photo: '',
    photoAlign: 'center',
    bio: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [oldPhoto, setOldPhoto] = useState<string | null>(null);
  // One object URL per selected file, revoked when it changes — creating one
  // in render leaked a blob on every keystroke in the form.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchConfig();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ensureIds = (members: any[]) => {
    return members.map((member, index) => ({
      ...member,
      id: member.id || `member-${index}-${Date.now()}`,
    }));
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/site-config');
      const data = await response.json();

      // Ensure all members have IDs
      if (data.weddingParty) {
        if (data.weddingParty.brideParty) {
          data.weddingParty.brideParty = ensureIds(data.weddingParty.brideParty);
        }
        if (data.weddingParty.groomParty) {
          data.weddingParty.groomParty = ensureIds(data.weddingParty.groomParty);
        }
        if (data.weddingParty.somethingBlueCrew) {
          data.weddingParty.somethingBlueCrew = ensureIds(data.weddingParty.somethingBlueCrew);
        }
      }

      setConfig(data);
      setLoaded(true);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  /* Exactly the keys `persistConfig` posts, so autosave watches what it writes
     and nothing else on the config can trigger a save from this page. */
  const payload = useMemo(() => (config ? {
    weddingParty: config.weddingParty,
    weddingPartySubtitle: config.weddingPartySubtitle,
    somethingBlueCrewTitle: config.somethingBlueCrewTitle,
    bridePartyTitle: config.bridePartyTitle,
    groomPartyTitle: config.groomPartyTitle,
  } : null), [config]);

  const save = useCallback(async () => { await persistConfig(config); }, [config]);
  const { state, retry } = useAutosave({ value: payload, ready: loaded, save });

  const handleDragEnd = (event: DragEndEvent, party: 'bride' | 'groom' | 'somethingBlueCrew') => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const partyKey = party === 'bride' ? 'brideParty' : party === 'groom' ? 'groomParty' : 'somethingBlueCrew';
      const members = config.weddingParty[partyKey];

      const oldIndex = members.findIndex((m: WeddingPartyMember) => m.id === active.id);
      const newIndex = members.findIndex((m: WeddingPartyMember) => m.id === over.id);

      const next = {
        ...config,
        weddingParty: { ...config.weddingParty, [partyKey]: arrayMove(members, oldIndex, newIndex) },
      };
      setConfig(next);
    }
  };

  // Only the keys this page edits — see the Settings page for why the whole
  // config is never posted back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persistConfig = async (cfg: any) => {
    const response = await fetch('/api/admin/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weddingParty: cfg.weddingParty,
        weddingPartySubtitle: cfg.weddingPartySubtitle,
        somethingBlueCrewTitle: cfg.somethingBlueCrewTitle,
        bridePartyTitle: cfg.bridePartyTitle,
        groomPartyTitle: cfg.groomPartyTitle,
      }),
    });
    if (!response.ok) {
      throw new Error('Не удалось сохранить');
    }
  };

  const addMember = (party: 'bride' | 'groom' | 'somethingBlueCrew' | 'officiant') => {
    setEditingParty(party);
    setEditingIndex(null);
    setFormData({
      id: `member-new-${Date.now()}`,
      name: '',
      role: '',
      relationship: '',
      photo: '',
      photoAlign: 'center',
      bio: '',
    });
    setSelectedFile(null);
    setOldPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const editMember = (party: 'bride' | 'groom' | 'somethingBlueCrew', index: number) => {
    const members = party === 'bride'
      ? config.weddingParty?.brideParty || []
      : party === 'groom'
      ? config.weddingParty?.groomParty || []
      : config.weddingParty?.somethingBlueCrew || [];

    setEditingParty(party);
    setEditingIndex(index);
    setFormData(members[index]);
    setSelectedFile(null);
    setOldPhoto(members[index].photo || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const editOfficiant = () => {
    setEditingParty('officiant');
    setEditingIndex(null);
    const officiant = config.weddingParty?.officiant;
    setFormData({
      id: 'officiant',
      name: officiant?.name || '',
      role: 'Ведущий церемонии',
      relationship: officiant?.relationship || '',
      photo: officiant?.photo || '',
      photoAlign: officiant?.photoAlign || 'center',
      bio: officiant?.bio || '',
    });
    setSelectedFile(null);
    setOldPhoto(officiant?.photo || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveMember = async () => {
    if (!config.weddingParty) {
      config.weddingParty = { brideParty: [], groomParty: [] };
    }

    setUploading(true);

    try {
      let photoFilename = formData.photo;

      // Upload new photo if selected
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('photo', selectedFile);
        uploadFormData.append('memberType', editingParty || 'member');
        uploadFormData.append('memberId', formData.id);

        const uploadRes = await fetch('/api/admin/wedding-party', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoFilename = uploadData.filename;

          // Delete old photo if it exists and is different
          if (oldPhoto && oldPhoto !== photoFilename) {
            await fetch(`/api/admin/wedding-party?filename=${oldPhoto}`, {
              method: 'DELETE',
            });
          }
        } else {
          throw new Error('Не удалось загрузить фото');
        }
      }

      // Update member data
      const updatedFormData = { ...formData, photo: photoFilename };

      if (editingParty === 'officiant') {
        // Save officiant
        config.weddingParty.officiant = {
          name: updatedFormData.name,
          relationship: updatedFormData.relationship,
          photo: updatedFormData.photo,
          photoAlign: updatedFormData.photoAlign,
          bio: updatedFormData.bio,
        };
      } else {
        const partyKey = editingParty === 'bride' ? 'brideParty' : editingParty === 'groom' ? 'groomParty' : 'somethingBlueCrew';

        // Initialize array if it doesn't exist
        if (!config.weddingParty[partyKey]) {
          config.weddingParty[partyKey] = [];
        }

        if (editingIndex === null) {
          // Add new member
          config.weddingParty[partyKey].push(updatedFormData);
        } else {
          // Edit existing member
          config.weddingParty[partyKey][editingIndex] = updatedFormData;
        }
      }

      // Autosave picks this up; writing here as well would send the same
      // change twice.
      setConfig({ ...config });
      setEditingParty(null);
      setEditingIndex(null);
      setSelectedFile(null);
      setOldPhoto(null);
    } catch (error) {
      console.error('Error saving member:', error);
      alert('Не удалось сохранить участника. Попробуйте снова.');
    } finally {
      setUploading(false);
    }
  };

  const deleteOfficiant = () => {
    if (!confirm('Удалить ведущего церемонии?')) return;
    if (config.weddingParty) {
      delete config.weddingParty.officiant;
      setConfig({ ...config });
    }
  };

  const deleteMember = (party: 'bride' | 'groom' | 'somethingBlueCrew', index: number) => {
    if (!confirm('Удалить этого участника?')) return;

    const partyKey = party === 'bride' ? 'brideParty' : party === 'groom' ? 'groomParty' : 'somethingBlueCrew';
    config.weddingParty[partyKey].splice(index, 1);
    setConfig({ ...config });
  };

  if (loading) {
    return <div className="p-8">Загрузка...</div>;
  }

  const brideParty = config.weddingParty?.brideParty || [];
  const groomParty = config.weddingParty?.groomParty || [];
  const somethingBlueCrew = config.weddingParty?.somethingBlueCrew || [];

  return (
    <div className="max-w-6xl">
      <AutosaveHeader
        title="Управление нашими близкими"
        subtitle="Добавляйте близких и участников церемонии. Изменения сохраняются автоматически."
        state={state}
        onRetry={retry}
      />

      {/* Page Subtitle Section */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Настройки страницы</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Подпись под заголовком «Наши близкие»
            </label>
            <input
              type="text"
              value={config.weddingPartySubtitle || ''}
              onChange={(e) => setConfig({ ...config, weddingPartySubtitle: e.target.value })}
              placeholder="Люди, которые будут рядом с нами в этот важный день"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              Этот текст показан вверху страницы «Наши близкие»
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{config.brideName} — заголовок раздела</label>
              <input
                type="text"
                value={config.bridePartyTitle || ''}
                onChange={(e) => setConfig({ ...config, bridePartyTitle: e.target.value })}
                placeholder={`${config.brideName} — подруги невесты`}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{config.groomName} — заголовок раздела</label>
              <input
                type="text"
                value={config.groomPartyTitle || ''}
                onChange={(e) => setConfig({ ...config, groomPartyTitle: e.target.value })}
                placeholder={`${config.groomName} — друзья жениха`}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заголовок раздела команды поддержки
            </label>
            <input
              type="text"
              value={config.somethingBlueCrewTitle || ''}
              onChange={(e) => setConfig({ ...config, somethingBlueCrewTitle: e.target.value })}
              placeholder="Команда поддержки"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              Свой заголовок третьего раздела
            </p>
          </div>
        </div>
      </div>

      {/* Bride's Party */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{config.brideName} — близкие</h2>
          <button
            onClick={() => addMember('bride')}
            className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90"
          >
            Добавить участника
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, 'bride')}
        >
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            {brideParty.length === 0 ? (
              <p className="p-6 text-gray-500 text-center">Участники пока не добавлены</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Роль</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Кем приходится</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <SortableContext
                  items={brideParty.map((m: WeddingPartyMember) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="bg-white divide-y divide-gray-200">
                    {brideParty.map((member: WeddingPartyMember, index: number) => (
                      <SortableRow
                        key={member.id}
                        member={member}
                        index={index}
                        party="bride"
                        onEdit={editMember}
                        onDelete={deleteMember}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            )}
          </div>
        </DndContext>
      </div>

      {/* Groom's Party */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{config.groomName} — близкие</h2>
          <button
            onClick={() => addMember('groom')}
            className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90"
          >
            Добавить участника
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, 'groom')}
        >
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            {groomParty.length === 0 ? (
              <p className="p-6 text-gray-500 text-center">Участники пока не добавлены</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Роль</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Кем приходится</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <SortableContext
                  items={groomParty.map((m: WeddingPartyMember) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groomParty.map((member: WeddingPartyMember, index: number) => (
                      <SortableRow
                        key={member.id}
                        member={member}
                        index={index}
                        party="groom"
                        onEdit={editMember}
                        onDelete={deleteMember}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            )}
          </div>
        </DndContext>
      </div>

      {/* Something Blue Crew */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{config.somethingBlueCrewTitle || 'Команда поддержки'}</h2>
          <button
            onClick={() => addMember('somethingBlueCrew')}
            className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90"
          >
            Добавить участника
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, 'somethingBlueCrew')}
        >
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            {somethingBlueCrew.length === 0 ? (
              <p className="p-6 text-gray-500 text-center">Участники пока не добавлены</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Роль</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Кем приходится</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <SortableContext
                  items={somethingBlueCrew.map((m: WeddingPartyMember) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="bg-white divide-y divide-gray-200">
                    {somethingBlueCrew.map((member: WeddingPartyMember, index: number) => (
                      <SortableRow
                        key={member.id}
                        member={member}
                        index={index}
                        party="somethingBlueCrew"
                        onEdit={editMember}
                        onDelete={deleteMember}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            )}
          </div>
        </DndContext>
      </div>

      {/* Officiant */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Ведущий церемонии</h2>
          {!config.weddingParty?.officiant && (
            <button
              onClick={() => addMember('officiant')}
              className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90"
            >
              Добавить ведущего церемонии
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {!config.weddingParty?.officiant ? (
            <p className="p-6 text-gray-500 text-center">Ведущий церемонии пока не добавлен</p>
          ) : (
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {config.weddingParty.officiant.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {config.weddingParty.officiant.relationship}
                  </p>
                  {config.weddingParty.officiant.bio && (
                    <p className="text-sm text-gray-500 mt-2">
                      {config.weddingParty.officiant.bio}
                    </p>
                  )}
                  {config.weddingParty.officiant.photo && (
                    <p className="text-xs text-gray-400 mt-2">
                      Фото: {config.weddingParty.officiant.photo}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={editOfficiant}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={deleteOfficiant}
                    className="text-red-600 hover:text-red-900"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {/* Edit Modal */}
      {editingParty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">
              {editingIndex === null ? 'Добавить' : 'Изменить'} Участник
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>

              {editingParty !== 'officiant' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Роль * (например, свидетельница, свидетель, подруга невесты)
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Кем приходится (необязательно, например: {editingParty === 'officiant' ? 'Друг, священник, ведущий' : 'Сестра, лучший друг, брат'})
                </label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Фото (необязательно)
                </label>

                {/* Show current photo if exists */}
                {formData.photo && !selectedFile && (
                  <div className="mb-3 flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
                      <Image
                        src={`/api/photos/${formData.photo}`}
                        alt="Текущее фото"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, photo: '' });
                        setOldPhoto(formData.photo || '');
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Удалить фото
                    </button>
                  </div>
                )}

                {/* Show selected file preview */}
                {selectedFile && (
                  <div className="mb-3 flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-green-500">
                      <Image
                        src={previewUrl ?? ''}
                        alt="Новое фото"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-green-600 font-medium">Новое фото выбрано</span>
                      <span className="text-xs text-gray-500">{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-800 text-left"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload button */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                      }
                    }}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm hover:bg-gray-200 transition-colors"
                  >
                    {formData.photo || selectedFile ? 'Заменить фото' : 'Загрузить фото'}
                  </button>
                </div>

                {/* Photo alignment dropdown */}
                {(formData.photo || selectedFile) && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Выравнивание фото по вертикали
                    </label>
                    <select
                      value={formData.photoAlign || 'center'}
                      onChange={(e) => setFormData({ ...formData, photoAlign: e.target.value as 'top' | 'top-center' | 'center' | 'center-bottom' | 'bottom' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-accent focus:border-accent text-gray-900"
                    >
                      <option value="top">По верхнему краю</option>
                      <option value="top-center">Ближе к верхнему краю</option>
                      <option value="center">По центру (по умолчанию)</option>
                      <option value="center-bottom">Ближе к нижнему краю</option>
                      <option value="bottom">По нижнему краю</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Выберите положение фото внутри рамки по вертикали
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Об участнике (необязательно)
                </label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={4}
                  placeholder="Краткий рассказ об этом человеке..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => {
                  setEditingParty(null);
                  setSelectedFile(null);
                  setOldPhoto(null);
                }}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={saveMember}
                disabled={uploading || !formData.name || (editingParty !== 'officiant' && !formData.role)}
                className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50"
              >
                {uploading ? 'Сохраняем...' : (editingParty === 'officiant' ? (config.weddingParty?.officiant ? 'Обновить' : 'Добавить') : (editingIndex === null ? 'Добавить' : 'Обновить')) + ' ' + (editingParty === 'officiant' ? 'Ведущий церемонии' : 'Участник')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
