import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Atmosphere } from '@/components/Atmosphere';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { CreatePollSheet } from '@/features/chat/CreatePollSheet';
import { PollCard } from '@/features/chat/PollCard';
import { PollDetailSheet } from '@/features/chat/PollDetailSheet';
import { isHttpsUrl, splitMessageLinks } from '@/features/chat/messageLinks';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { ApiError } from '@/lib/apiClient';
import { chatCache } from '@/lib/cache/chatCache';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import {
  deleteTripMessage,
  listTripMessages,
  markTripChatTyping,
  sendTripMessage,
} from '@/services/chatService';
import {
  addTripPollOption,
  closeTripPoll,
  createTripPoll,
  deleteTripPoll,
  listTripPolls,
  removeTripPollVote,
  voteTripPoll,
} from '@/services/pollService';
import { colors, radius, spacing, typography } from '@/theme';
import type { ChatListItem, ChatReadReceipt } from '@/types/chat';
import type { CreatePollBody, TripPoll } from '@/types/poll';

type TripChatScreenProps = {
  tripId: string;
  /** Render inside the trip Chat tab (no second screen or extra chrome). */
  embedded?: boolean;
};

const POLL_MS = 4_000;

export function TripChatScreen({ tripId, embedded = false }: TripChatScreenProps) {
  const { user } = useAuth();
  const keyboardInset = useKeyboardInset();
  const seqRef = useRef(0);
  const sendingRef = useRef(false);
  const typingAtRef = useRef(0);
  const newerCursorRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);
  const stickToEndRef = useRef(true);
  const [messages, setMessages] = useState<ChatListItem[]>(() => chatCache.get(tripId)?.messages ?? []);
  const [polls, setPolls] = useState<TripPoll[]>(() => chatCache.get(tripId)?.polls ?? []);
  const [reads, setReads] = useState<ChatReadReceipt[]>([]);
  const [typingNames, setTypingNames] = useState<string[]>(() => chatCache.get(tripId)?.typingNames ?? []);
  const [olderCursor, setOlderCursor] = useState<string | null>(
    () => chatCache.get(tripId)?.olderCursor ?? null,
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(messages.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pollsOpen, setPollsOpen] = useState(false);
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: 'message'; id: string } | { kind: 'poll'; id: string } | null
  >(null);

  const pollMap = useMemo(() => new Map(polls.map((poll) => [poll.id, poll])), [polls]);
  const activePoll = activePollId ? pollMap.get(activePollId) ?? null : null;

  const persist = useCallback(
    (nextMessages: ChatListItem[], nextPolls: TripPoll[], nextOlder: string | null, names: string[]) => {
      chatCache.set(tripId, {
        messages: nextMessages,
        polls: nextPolls,
        olderCursor: nextOlder,
        newerCursor: newerCursorRef.current,
        typingNames: names,
      });
    },
    [tripId],
  );

  const loadLatest = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      const seq = ++seqRef.current;
      if (mode === 'initial') {
        setLoading(true);
      }
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        const [page, pollPage] = await Promise.all([
          listTripMessages(tripId, { limit: 30 }),
          listTripPolls(tripId),
        ]);
        if (seq !== seqRef.current) {
          return;
        }
        newerCursorRef.current = page.newerCursor;
        setMessages(page.messages);
        setPolls(pollPage.polls);
        setReads(page.reads);
        setTypingNames(page.typing.map((person) => person.name));
        setOlderCursor(page.olderCursor);
        setError(null);
        persist(
          page.messages,
          pollPage.polls,
          page.olderCursor,
          page.typing.map((person) => person.name),
        );
      } catch (err) {
        if (seq !== seqRef.current) {
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load trip chat.');
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [persist, tripId],
  );

  const syncNew = useCallback(async () => {
    try {
      const after = newerCursorRef.current;
      const [page, pollPage] = await Promise.all([
        listTripMessages(tripId, after ? { after, limit: 30 } : { limit: 30 }),
        listTripPolls(tripId),
      ]);
      setPolls(pollPage.polls);
      setReads(page.reads);
      setTypingNames(page.typing.map((person) => person.name));
      if (!after) {
        newerCursorRef.current = page.newerCursor;
        setMessages(page.messages);
        setOlderCursor(page.olderCursor);
        persist(page.messages, pollPage.polls, page.olderCursor, page.typing.map((person) => person.name));
        return;
      }
      if (page.messages.length === 0) {
        return;
      }
      newerCursorRef.current = page.newerCursor ?? newerCursorRef.current;
      setMessages((current) => {
        const next = mergeById(current, page.messages);
        persist(next, pollPage.polls, olderCursor, page.typing.map((person) => person.name));
        return next;
      });
    } catch {
      // Keep the open conversation; the next tick retries.
    }
  }, [olderCursor, persist, tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadLatest(chatCache.get(tripId)?.messages.length ? 'silent' : 'initial');
      const handle = setInterval(() => {
        void syncNew();
      }, POLL_MS);
      return () => {
        clearInterval(handle);
        seqRef.current += 1;
      };
    }, [loadLatest, syncNew, tripId]),
  );

  async function onSend() {
    const body = draft.trim();
    if (!body || sendingRef.current || !user) {
      return;
    }
    sendingRef.current = true;
    const nonce = `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const local: ChatListItem = {
      id: nonce,
      tripId,
      kind: 'text',
      body,
      deleted: false,
      pollId: null,
      sender: { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null },
      createdAt: new Date().toISOString(),
      clientNonce: nonce,
      mine: true,
      status: 'sending',
    };
    setDraft('');
    stickToEndRef.current = true;
    setMessages((current) => [...current, local]);
    try {
      const saved = await sendTripMessage(tripId, body, nonce);
      setMessages((current) =>
        current.map((item) => (item.id === nonce || item.clientNonce === nonce ? { ...saved, status: 'sent' } : item)),
      );
    } catch {
      setMessages((current) =>
        current.map((item) => (item.id === nonce ? { ...item, status: 'failed' } : item)),
      );
    } finally {
      sendingRef.current = false;
    }
  }

  async function retryMessage(item: ChatListItem) {
    if (item.status !== 'failed' || !item.clientNonce) {
      return;
    }
    setMessages((current) =>
      current.map((row) => (row.id === item.id ? { ...row, status: 'sending' } : row)),
    );
    try {
      const saved = await sendTripMessage(tripId, item.body, item.clientNonce);
      setMessages((current) =>
        current.map((row) => (row.id === item.id ? { ...saved, status: 'sent' } : row)),
      );
    } catch {
      setMessages((current) =>
        current.map((row) => (row.id === item.id ? { ...row, status: 'failed' } : row)),
      );
    }
  }

  async function loadOlder() {
    if (!olderCursor || loadingOlder) {
      return;
    }
    stickToEndRef.current = false;
    setLoadingOlder(true);
    try {
      const page = await listTripMessages(tripId, { before: olderCursor, limit: 30 });
      setOlderCursor(page.olderCursor);
      setMessages((current) => mergeById(page.messages, current));
    } catch {
      setError('Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function onVote(pollId: string, optionId: string) {
    const poll = pollMap.get(pollId);
    if (!poll?.canVote) {
      return;
    }
    setPollBusy(true);
    setPollError(null);
    try {
      const nextIds =
        poll.voteType === 'multiple'
          ? toggleId(poll.ownOptionIds, optionId, poll.maxChoices)
          : [optionId];
      const updated = await voteTripPoll(tripId, pollId, nextIds);
      replacePoll(updated);
    } catch (err) {
      setPollError(err instanceof ApiError ? err.message : 'Could not save that vote.');
    } finally {
      setPollBusy(false);
    }
  }

  function replacePoll(updated: TripPoll) {
    setPolls((current) => {
      const next = current.some((item) => item.id === updated.id)
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...current];
      persist(messages, next, olderCursor, typingNames);
      return next;
    });
  }

  async function confirmDestructive() {
    const action = confirm;
    setConfirm(null);
    if (!action) {
      return;
    }
    try {
      if (action.kind === 'message') {
        await deleteTripMessage(tripId, action.id);
        setMessages((current) =>
          current.map((item) =>
            item.id === action.id ? { ...item, deleted: true, body: '' } : item,
          ),
        );
      } else {
        await deleteTripPoll(tripId, action.id);
        setPolls((current) => current.filter((item) => item.id !== action.id));
        setMessages((current) => current.filter((item) => item.pollId !== action.id));
        setActivePollId(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that.');
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - typingAtRef.current < 2_000) {
      return;
    }
    typingAtRef.current = now;
    void markTripChatTyping(tripId).catch(() => undefined);
  }

  if (loading && messages.length === 0) {
    return (
      <View style={[styles.root, embedded ? styles.rootEmbedded : null]}>
        {embedded ? null : <Atmosphere />}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const body = (
    <>
      <View style={[styles.toolbar, embedded ? styles.toolbarEmbedded : null]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View polls"
          onPress={() => setPollsOpen(true)}
          style={styles.toolButton}
        >
          <Text style={styles.toolLabel}>Polls</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a poll"
          onPress={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          style={styles.toolButton}
        >
          <Text style={styles.toolLabel}>New poll</Text>
        </Pressable>
      </View>
      {error ? (
        <ErrorState title="Chat unavailable" message={error} onRetry={() => void loadLatest('refresh')} />
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (stickToEndRef.current) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          stickToEndRef.current =
            contentSize.height - layoutMeasurement.height - contentOffset.y < 96;
        }}
        scrollEventThrottle={16}
        refreshing={refreshing || loadingOlder}
        onRefresh={() => void (olderCursor ? loadOlder() : loadLatest('refresh'))}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              title="Start the trip chat"
              message="Talk through ideas here, then create a poll when the group needs to decide."
              illustration="travel"
            />
          </View>
        }
        ListHeaderComponent={
          loadingOlder ? <ActivityIndicator color={colors.primary} style={styles.older} /> : null
        }
        renderItem={({ item }) => (
          <MessageRow
            item={item}
            poll={item.pollId ? pollMap.get(item.pollId) ?? null : null}
            reads={reads}
            messages={messages}
            onVote={(optionId) => void onVote(item.pollId ?? '', optionId)}
            onOpenPoll={() => item.pollId && setActivePollId(item.pollId)}
            onRetry={() => void retryMessage(item)}
            onDelete={() => setConfirm({ kind: 'message', id: item.id })}
          />
        )}
      />
      {typingNames.length > 0 ? (
        <Text style={styles.typing}>
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
        </Text>
      ) : null}
      <View style={[styles.composer, { marginBottom: embedded ? 0 : keyboardInset }]}>
        <TextInput
          accessibilityLabel="Message"
          value={draft}
          onChangeText={onDraftChange}
          placeholder="Message the group"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: draft.trim().length === 0 }}
          disabled={draft.trim().length === 0}
          onPress={() => void onSend()}
          style={[styles.send, draft.trim().length === 0 ? styles.sendDisabled : null]}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={[styles.root, embedded ? styles.rootEmbedded : null]}>
      {embedded ? null : <Atmosphere />}
      {embedded ? (
        <View style={styles.safe}>{body}</View>
      ) : (
        <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
          {body}
        </SafeAreaView>
      )}
      <CreatePollSheet
        visible={createOpen}
        submitting={createBusy}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => void submitPoll(body)}
      />
      <PollsListSheet
        visible={pollsOpen}
        polls={polls}
        onClose={() => setPollsOpen(false)}
        onOpen={(pollId) => {
          setPollsOpen(false);
          setActivePollId(pollId);
        }}
        onVote={(pollId, optionId) => void onVote(pollId, optionId)}
      />
      <PollDetailSheet
        visible={activePoll !== null}
        poll={activePoll}
        busy={pollBusy}
        error={pollError}
        onClose={() => setActivePollId(null)}
        onVote={(optionId) => activePoll && void onVote(activePoll.id, optionId)}
        onClearVote={() => activePoll && void clearVote(activePoll.id)}
        onAddOption={(label) => activePoll && void addOption(activePoll.id, label)}
        onClosePoll={() => activePoll && void closePoll(activePoll.id)}
        onDeletePoll={() => activePoll && setConfirm({ kind: 'poll', id: activePoll.id })}
      />
      <ConfirmDialog
        visible={confirm !== null}
        title={confirm?.kind === 'poll' ? 'Delete this poll?' : 'Delete this message?'}
        message={
          confirm?.kind === 'poll'
            ? 'Votes and the chat card will be removed. This cannot be undone.'
            : 'The group will see that this message was deleted.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirmDestructive()}
      />
    </View>
  );

  async function submitPoll(body: CreatePollBody) {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createTripPoll(tripId, body);
      setCreateOpen(false);
      replacePoll(created);
      await loadLatest('silent');
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create that poll.');
    } finally {
      setCreateBusy(false);
    }
  }

  async function clearVote(pollId: string) {
    setPollBusy(true);
    setPollError(null);
    try {
      replacePoll(await removeTripPollVote(tripId, pollId));
    } catch (err) {
      setPollError(err instanceof ApiError ? err.message : 'Could not remove that vote.');
    } finally {
      setPollBusy(false);
    }
  }

  async function addOption(pollId: string, label: string) {
    setPollBusy(true);
    setPollError(null);
    try {
      replacePoll(await addTripPollOption(tripId, pollId, label));
    } catch (err) {
      setPollError(err instanceof ApiError ? err.message : 'Could not add that option.');
    } finally {
      setPollBusy(false);
    }
  }

  async function closePoll(pollId: string) {
    setPollBusy(true);
    setPollError(null);
    try {
      replacePoll(await closeTripPoll(tripId, pollId));
    } catch (err) {
      setPollError(err instanceof ApiError ? err.message : 'Could not close this poll.');
    } finally {
      setPollBusy(false);
    }
  }
}

function MessageRow({
  item,
  poll,
  reads,
  messages,
  onVote,
  onOpenPoll,
  onRetry,
  onDelete,
}: {
  item: ChatListItem;
  poll: TripPoll | null;
  reads: ChatReadReceipt[];
  messages: ChatListItem[];
  onVote: (optionId: string) => void;
  onOpenPoll: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const mine = item.mine;
  const seen = mine ? seenByNames(item, reads, messages) : [];

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <UserAvatar
          name={item.sender.name}
          uri={item.sender.avatarUrl}
          cacheKey={`avatar:${item.sender.id}`}
          size="xs"
        />
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <View
        style={[
          styles.bubble,
          item.kind === 'poll' ? styles.bubblePoll : mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {!mine ? <Text style={styles.sender}>{item.sender.name}</Text> : null}
        {item.kind === 'poll' && poll ? (
          <PollCard poll={poll} compact voting={false} onVote={onVote} onOpen={onOpenPoll} />
        ) : item.deleted ? (
          <Text style={styles.deleted}>This message was deleted.</Text>
        ) : (
          <Pressable
            onLongPress={mine && item.kind === 'text' && !item.deleted ? onDelete : undefined}
            delayLongPress={350}
          >
            <MessageBody text={item.body} mine={mine} />
          </Pressable>
        )}
        <Text style={[styles.time, mine ? styles.timeMine : null]}>
          {item.status === 'sending'
            ? 'Sending…'
            : item.status === 'failed'
              ? 'Not sent'
              : formatRelativeTime(item.createdAt)}
        </Text>
        {item.status === 'failed' ? (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        ) : null}
        {seen.length > 0 ? <Text style={styles.seen}>Seen by {seen.join(', ')}</Text> : null}
      </View>
    </View>
  );
}

function MessageBody({ text, mine }: { text: string; mine: boolean }) {
  const parts = splitMessageLinks(text);
  return (
    <Text style={[styles.body, mine ? styles.bodyMine : null]}>
      {parts.map((part, index) =>
        part.type === 'link' && isHttpsUrl(part.value) ? (
          <Text
            key={`${part.value}-${index}`}
            style={styles.link}
            onPress={() => void Linking.openURL(part.value)}
          >
            {part.value}
          </Text>
        ) : (
          <Text key={`${part.value}-${index}`}>{part.value}</Text>
        ),
      )}
    </Text>
  );
}

function PollsListSheet({
  visible,
  polls,
  onClose,
  onOpen,
  onVote,
}: {
  visible: boolean;
  polls: TripPoll[];
  onClose: () => void;
  onOpen: (pollId: string) => void;
  onVote: (pollId: string, optionId: string) => void;
}) {
  return (
    <BottomFormSheet visible={visible} onClose={onClose} title="Trip polls">
      {polls.length === 0 ? (
        <Text style={styles.pollEmpty}>No polls yet. Start one from New poll.</Text>
      ) : (
        polls.map((poll) => (
          <View key={poll.id} style={styles.pollItem}>
            <PollCard poll={poll} compact onVote={(optionId) => onVote(poll.id, optionId)} onOpen={() => onOpen(poll.id)} />
          </View>
        ))
      )}
    </BottomFormSheet>
  );
}

function mergeById(left: ChatListItem[], right: ChatListItem[]): ChatListItem[] {
  const map = new Map<string, ChatListItem>();
  for (const item of left) {
    map.set(item.id, item);
  }
  for (const item of right) {
    map.set(item.id, { ...item, status: item.status ?? 'sent' });
  }
  return [...map.values()].sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return a.id.localeCompare(b.id);
    }
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function toggleId(current: string[], optionId: string, maxChoices: number | null): string[] {
  if (current.includes(optionId)) {
    return current.filter((id) => id !== optionId);
  }
  const next = [...current, optionId];
  if (maxChoices && next.length > maxChoices) {
    return next.slice(next.length - maxChoices);
  }
  return next;
}

function seenByNames(item: ChatListItem, reads: ChatReadReceipt[], messages: ChatListItem[]): string[] {
  const index = messages.findIndex((row) => row.id === item.id);
  if (index < 0) {
    return [];
  }
  return reads
    .filter((read) => {
      const readIndex = messages.findIndex((row) => row.id === read.lastReadMessageId);
      return readIndex >= index;
    })
    .map((read) => read.name);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  rootEmbedded: {
    backgroundColor: 'transparent',
    minHeight: 0,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  toolbarEmbedded: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  toolButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.seafoam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    paddingVertical: spacing.xxl,
  },
  older: {
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  rowMine: {
    flexDirection: 'row-reverse',
  },
  rowTheirs: {
    flexDirection: 'row',
  },
  avatarSpacer: {
    width: 32,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubblePoll: {
    backgroundColor: 'transparent',
    padding: 0,
    maxWidth: '90%',
  },
  sender: {
    ...typography.label,
    fontSize: 12,
    color: colors.primary,
  },
  body: {
    ...typography.body,
    color: colors.ink,
  },
  bodyMine: {
    color: colors.onPrimary,
  },
  link: {
    textDecorationLine: 'underline',
  },
  deleted: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.muted,
  },
  time: {
    ...typography.body,
    fontSize: 11,
    lineHeight: 14,
    color: colors.muted,
  },
  timeMine: {
    color: colors.seafoam,
  },
  retry: {
    ...typography.label,
    fontSize: 12,
    color: colors.warningSurface,
  },
  seen: {
    ...typography.body,
    fontSize: 11,
    lineHeight: 14,
    color: colors.seafoam,
  },
  typing: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.ink,
  },
  send: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    ...typography.label,
    color: colors.onPrimary,
  },
  pollEmpty: {
    ...typography.body,
    color: colors.muted,
  },
  pollItem: {
    marginBottom: spacing.md,
  },
});
