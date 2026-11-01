-- =============================================================================
-- Date demo pentru dezvoltare LOCALĂ (rulat de `supabase db reset`). Nu se aplică în producție.
-- Conturi (parola pentru toate: Demo12345):
--   admin@demo.md (Administrator) · manager@demo.md (Manager, echipa Chișinău)
--   agent@demo.md și agent2@demo.md (Agenți, echipa Chișinău)
-- =============================================================================

do $$
declare
  v_admin uuid := '10000000-0000-0000-0000-000000000001';
  v_manager uuid := '10000000-0000-0000-0000-000000000002';
  v_agent uuid := '10000000-0000-0000-0000-000000000003';
  v_agent2 uuid := '10000000-0000-0000-0000-000000000004';
  v_org uuid := '20000000-0000-0000-0000-000000000001';
  v_team uuid;
  v_pipeline uuid;
  v_stages uuid[];
  v_sources uuid[];
  v_reasons uuid[];
  v_types uuid[];
  v_companies uuid[] := '{}';
  v_contacts uuid[] := '{}';
  v_owners uuid[];
  v_lead uuid;
  v_id uuid;
  v_pos int;
  v_created timestamptz;
  v_closed timestamptz;
  v_last int;
  v_step int;
  i int;
  v_first text[] := array['Andrei', 'Maria', 'Ion', 'Elena', 'Victor', 'Natalia', 'Sergiu', 'Cristina',
                          'Alexandru', 'Olga', 'Dumitru', 'Irina', 'Vlad', 'Tatiana', 'Mihai', 'Ana',
                          'Igor', 'Diana', 'Pavel', 'Ludmila'];
  v_last_names text[] := array['Rusu', 'Ceban', 'Munteanu', 'Popa', 'Lungu', 'Ciobanu', 'Țurcan', 'Rotaru',
                               'Sârbu', 'Cojocaru', 'Morari', 'Bivol', 'Guțu', 'Plămădeală', 'Croitoru'];
  v_company_names text[] := array['Agro Nord SRL', 'TechSoft Solutions', 'Moldcarton', 'Vinăria Codru',
                                  'Construct Plus', 'Farmacia Sănătate', 'Logistic Express', 'Hotel Central',
                                  'Mobila Design', 'EduCenter'];
  v_industries text[] := array['Agricultură', 'IT', 'Producție', 'Vinificație', 'Construcții', 'Farmacie',
                               'Transport', 'HoReCa', 'Mobilă', 'Educație'];
  v_titles text[] := array['Implementare CRM', 'Licențe software', 'Contract anual de mentenanță',
                           'Echipamente birou', 'Consultanță', 'Abonament servicii', 'Proiect site web',
                           'Instruire personal', 'Integrare contabilitate', 'Extindere licențe'];
begin
  perform setseed(0.42);

  -- ------------------------------------------------------------ utilizatori
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('Demo12345', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(),
         '', '', '', '', '', '', '', ''
  from (values (v_admin, 'admin@demo.md', 'Ana Rusu'),
               (v_manager, 'manager@demo.md', 'Victor Ceban'),
               (v_agent, 'agent@demo.md', 'Elena Munteanu'),
               (v_agent2, 'agent2@demo.md', 'Ion Popa')) as u(id, email, name);

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u where u.id in (v_admin, v_manager, v_agent, v_agent2);

  -- ------------------------------------------------------------ organizație + roluri + echipă
  insert into public.organizations (id, name, slug, legal_name, fiscal_code)
  values (v_org, 'Univers Demo SRL', 'univers-demo', 'Univers Demo S.R.L.', '1003600099999');
  perform private.seed_organization(v_org);

  insert into public.memberships (organization_id, user_id, role_id)
  select v_org, m.user_id, r.id
  from (values (v_admin, 'admin'), (v_manager, 'manager'), (v_agent, 'agent'), (v_agent2, 'agent'))
         as m(user_id, role_key)
  join public.roles r on r.organization_id = v_org and r.key = m.role_key;

  insert into public.teams (organization_id, name, manager_id)
  values (v_org, 'Echipa Chișinău', v_manager) returning id into v_team;
  insert into public.team_members (organization_id, team_id, user_id)
  values (v_org, v_team, v_agent), (v_org, v_team, v_agent2);

  select id into v_pipeline from public.pipelines where organization_id = v_org and is_default;
  select array_agg(id order by position) into v_stages from public.pipeline_stages where pipeline_id = v_pipeline;
  select array_agg(id order by position) into v_sources from public.lead_sources where organization_id = v_org;
  select array_agg(id order by position) into v_reasons from public.loss_reasons where organization_id = v_org;
  select array_agg(id order by position) into v_types from public.task_types where organization_id = v_org;
  v_owners := array[v_agent, v_agent2, v_agent, v_agent2, v_manager, null];

  insert into public.tags (organization_id, name, color)
  values (v_org, 'VIP', '#dc2626'), (v_org, 'Revenire', '#f59e0b'), (v_org, 'B2B', '#3b82f6');

  -- ------------------------------------------------------------ companii
  for i in 1 .. array_length(v_company_names, 1) loop
    insert into public.companies (organization_id, name, industry, phone, email, website, address, owner_id, created_by)
    values (v_org, v_company_names[i], v_industries[i], '+373 22 ' || (200000 + i * 7919 % 99999),
            'office@' || lower(regexp_replace(v_company_names[i], '[^A-Za-z]', '', 'g')) || '.md',
            'https://' || lower(regexp_replace(v_company_names[i], '[^A-Za-z]', '', 'g')) || '.md',
            jsonb_build_object('city', 'Chișinău', 'country', 'MD'),
            v_owners[1 + i % 5], v_admin)
    returning id into v_id;
    v_companies := v_companies || v_id;
  end loop;

  -- ------------------------------------------------------------ contacte + identități
  for i in 1 .. 24 loop
    insert into public.contacts (organization_id, first_name, last_name, company_id, position, source_id,
                                 owner_id, created_by)
    values (v_org, v_first[1 + (i - 1) % 20], v_last_names[1 + (i * 7) % 15],
            case when i % 3 <> 0 then v_companies[1 + (i - 1) % 10] end,
            (array['Director', 'Manager achiziții', 'Contabil-șef', 'Administrator', 'Specialist IT'])[1 + i % 5],
            v_sources[1 + i % 8], v_owners[1 + i % 6], v_admin)
    returning id into v_id;
    v_contacts := v_contacts || v_id;

    insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
    values (v_org, v_id, 'phone', '+373 6' || (9000000 + i * 104729 % 999999), true),
           (v_org, v_id, 'email', lower(v_first[1 + (i - 1) % 20]) || '.' || i || '@exemplu.md', true);
  end loop;

  -- Un duplicat intenționat (același telefon ca primul contact), pentru testarea detectării.
  insert into public.contacts (organization_id, first_name, last_name, owner_id, created_by)
  values (v_org, 'Andrei', 'Rusu (duplicat)', v_agent, v_admin) returning id into v_id;
  insert into public.contact_identities (organization_id, contact_id, type, value)
  select v_org, v_id, 'phone', replace(value, ' ', '') from public.contact_identities
  where contact_id = v_contacts[1] and type = 'phone';

  -- ------------------------------------------------------------ lead-uri cu istoric pe 90 de zile
  for i in 1 .. 40 loop
    v_pos := (array[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8])[1 + i % 20];
    v_created := now() - make_interval(days => (random() * 88)::int + 2, hours => (random() * 10)::int);

    insert into public.leads (organization_id, title, pipeline_id, stage_id, company_id, source_id, value,
                              responsible_id, team_id, priority, description, position, created_by,
                              loss_reason_id)
    values (v_org, v_titles[1 + i % 10] || ' — ' || v_company_names[1 + i % 10], v_pipeline, v_stages[v_pos],
            v_companies[1 + i % 10], v_sources[1 + i % 8], (round(random() * 95 + 5) * 1000)::numeric,
            v_owners[1 + i % 6], case when v_owners[1 + i % 6] is not null then v_team end,
            (array['low', 'normal', 'normal', 'high', 'urgent'])[1 + i % 5]::public.lead_priority,
            'Client interesat de ' || lower(v_titles[1 + i % 10]) || '.', i, v_admin,
            case when v_pos = 8 then v_reasons[1 + i % 6] end)
    returning id into v_lead;

    insert into public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
    values (v_org, v_lead, v_contacts[1 + i % 24], true);

    -- Datare retroactivă și istoric de etape realist (fără a declanșa din nou triggerele).
    set local session_replication_role = replica;

    v_last := case when v_pos = 7 then 6 when v_pos = 8 then 1 + i % 5 else v_pos end;
    v_closed := case when v_pos >= 7
                     then least(now() - interval '1 hour', v_created + make_interval(days => 3 + (random() * 25)::int))
                end;

    delete from public.lead_stage_history where lead_id = v_lead;
    for v_step in 1 .. v_last loop
      insert into public.lead_stage_history (organization_id, lead_id, pipeline_id, from_stage_id, to_stage_id,
                                             changed_by, changed_at)
      values (v_org, v_lead, v_pipeline, case when v_step > 1 then v_stages[v_step - 1] end, v_stages[v_step],
              v_admin, v_created + (coalesce(v_closed, now()) - v_created) * ((v_step - 1)::float / greatest(v_last, 1)));
    end loop;
    if v_pos >= 7 then
      insert into public.lead_stage_history (organization_id, lead_id, pipeline_id, from_stage_id, to_stage_id,
                                             changed_by, changed_at)
      values (v_org, v_lead, v_pipeline, v_stages[v_last], v_stages[v_pos], v_admin, v_closed);
    end if;

    update public.leads
    set created_at = v_created,
        closed_at = v_closed,
        stage_entered_at = coalesce(v_closed, v_created + (now() - v_created) * 0.6),
        last_activity_at = coalesce(v_closed, now() - make_interval(days => (random() * 12)::int)),
        updated_at = coalesce(v_closed, now())
    where id = v_lead;
    update public.activities set occurred_at = v_created where lead_id = v_lead and type = 'lead.created';

    set local session_replication_role = origin;

    -- Sarcini: restante, pentru azi, viitoare, finalizate.
    if v_pos < 7 then
      insert into public.tasks (organization_id, type_id, title, responsible_id, lead_id, due_at, priority, created_by)
      values (v_org, v_types[1 + i % 6],
              (array['Sună clientul', 'Trimite oferta', 'Întâlnire de prezentare', 'Follow-up după ofertă',
                     'Pregătește contractul', 'Verifică plata'])[1 + i % 6],
              coalesce(v_owners[1 + i % 6], v_manager), v_lead,
              date_trunc('hour', now()) + make_interval(days => (i % 7) - 2, hours => 9 + i % 8 - extract(hour from now())::int),
              'normal', v_admin);
    end if;
    if i % 4 = 0 then
      insert into public.notes (organization_id, lead_id, body, created_by)
      values (v_org, v_lead, 'Clientul a cerut detalii suplimentare despre termene și condiții de plată.', v_admin);
    end if;
  end loop;

  -- Câteva sarcini finalizate (pentru rapoartele de activitate).
  update public.tasks set status = 'done', result = 'Realizat'
  where organization_id = v_org and id in (
    select id from public.tasks where organization_id = v_org order by due_at limit 6);

  -- Evenimentele generate de seed nu trebuie procesate de automatizări; auditul seed-ului e zgomot.
  update public.domain_events set processed_at = now() where organization_id = v_org;
  delete from public.audit_log where organization_id = v_org;
end;
$$;
