CREATE OR REPLACE FUNCTION public.enforce_guest_move_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id AND u.is_anonymous)
     AND (SELECT count(*) FROM public.moves WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'GUEST_MOVE_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_guest_move_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guest_move_limit BEFORE INSERT ON public.moves FOR EACH ROW EXECUTE FUNCTION public.enforce_guest_move_limit();

CREATE OR REPLACE FUNCTION public.enforce_guest_chat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'user'
     AND EXISTS (SELECT 1 FROM public.moves m JOIN auth.users u ON u.id = m.user_id WHERE m.id = NEW.move_id AND u.is_anonymous)
     AND (SELECT count(*) FROM public.chat_messages WHERE move_id = NEW.move_id AND role IN ('user','assistant')) >= 30 THEN
    RAISE EXCEPTION 'GUEST_CHAT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_guest_chat_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guest_chat_limit BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.enforce_guest_chat_limit();