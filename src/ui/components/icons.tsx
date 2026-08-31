import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function IconCalendar(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IconMusic(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function IconScoreSheet(props: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="8 10 82 82"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M76.3,14.9v68.3H23.7V14.9H76.3 M82.3,8.9H17.7v80.3h64.6V8.9L82.3,8.9z"
      />
      <path d="M37.2,71.2c-3.5,0-6.3-1.9-6.9-4.7c-0.3-1.6,0.2-3.3,1.4-4.7c1.2-1.4,3-2.4,5-2.8c0.6-0.1,1.2-0.2,1.8-0.2  c1.1,0,2.1,0.2,3,0.5V37.7l24.2-9.3v30.3L65.7,59c-0.3,2.8-2.9,5.2-6.4,5.9c-0.6,0.1-1.3,0.2-1.9,0.2c-3.5,0-6.3-1.9-6.9-4.7  c-0.3-1.6,0.2-3.3,1.4-4.7c1.2-1.4,3-2.4,5-2.8c0.6-0.1,1.2-0.2,1.8-0.2c1.1,0,2.1,0.2,3,0.5V39.4l-16.2,6.2v18l0,0.8  c0,3-2.8,5.8-6.4,6.5C38.5,71.1,37.8,71.2,37.2,71.2z"
      />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function IconVolumeMuted(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function IconWhatsApp(props: IconProps) {
  return (
    <svg
      {...defaults}
      fill="currentColor"
      stroke="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

export function IconList(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function IconColumns(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  );
}

export function IconCake(props: IconProps) {
  return (
    <svg {...defaults} {...props} fill="currentColor" stroke="none" viewBox="0 0 32 32">
        <path d="M7.38,30.74H24.62c.41,0,.75-.34,.75-.75V14.59c0-.41-.34-.75-.75-.75h-2.66v-5.38c0-.2-.08-.39-.21-.52,.43-.65,.67-1.43,.67-2.23,0-1.35-.67-2.6-1.78-3.37-.26-.17-.59-.17-.85,0-1.12,.76-1.78,2.02-1.78,3.37,0,.8,.24,1.57,.67,2.23-.13,.14-.21,.32-.21,.52v5.38h-5.52v-5.38c0-.2-.08-.39-.21-.52,.43-.65,.67-1.43,.67-2.23,0-1.35-.67-2.6-1.78-3.37-.26-.17-.59-.17-.85,0-1.12,.76-1.78,2.02-1.78,3.37,0,.8,.24,1.57,.67,2.23-.13,.14-.21,.32-.21,.52v5.38h-2.07c-.41,0-.75,.34-.75,.75v15.4c0,.41,.34,.75,.75,.75Zm16.49-5.27H8.13v-6.83c.14,.1,.27,.23,.44,.39,.46,.46,1.08,1.08,2.25,1.08s1.8-.63,2.25-1.08c.43-.43,.66-.64,1.19-.64s.76,.21,1.19,.64c.46,.46,1.08,1.08,2.25,1.08s1.8-.63,2.26-1.08c.43-.43,.67-.64,1.19-.64s.76,.21,1.2,.64c.35,.35,.79,.79,1.51,.98v5.46Zm0,3.77H8.13v-2.27h15.74v2.27ZM20.21,3.94c.45,.48,.71,1.11,.71,1.77s-.26,1.29-.71,1.77c-.45-.48-.71-1.11-.71-1.77s.26-1.29,.71-1.77Zm-.25,5.27h.5v4.63h-.5v-4.63ZM11.2,3.94c.45,.48,.71,1.11,.71,1.77s-.26,1.29-.71,1.77c-.45-.48-.71-1.11-.71-1.77s.26-1.29,.71-1.77Zm-.25,5.27h.5v4.63h-.5v-4.63Zm-.75,6.13h13.67v3.02c-.14-.1-.28-.23-.45-.4-.46-.46-1.08-1.08-2.26-1.08s-1.8,.63-2.26,1.08c-.43,.43-.67,.64-1.2,.64s-.76-.21-1.19-.64c-.46-.46-1.08-1.08-2.25-1.08s-1.8,.63-2.25,1.08c-.43,.43-.67,.64-1.19,.64s-.76-.21-1.19-.64c-.35-.35-.79-.79-1.5-.98v-1.64h2.07Z">
        </path>
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

export function IconGroups(props: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="m31.09 80.547h-26.18c-0.80469 0-1.4531-0.65234-1.4531-1.4531v-10.184c0-8.0195 6.5234-14.547 14.547-14.547 8.0195 0 14.547 6.5234 14.547 14.547v10.184c-0.003906 0.80078-0.65625 1.4531-1.4609 1.4531zm-24.727-2.9102h23.273v-8.7266c0-6.418-5.2188-11.637-11.637-11.637s-11.637 5.2188-11.637 11.637z" />
      <path d="m18 57.273c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164s2.6094 5.8164 5.8164 5.8164 5.8164-2.6094 5.8164-5.8164-2.6094-5.8164-5.8164-5.8164z" />
      <path d="m39.094 42.766c-0.47266 0-0.93359-0.23047-1.2148-0.65234-0.42578-0.64453-0.92188-1.2461-1.4688-1.7969-2.1992-2.1953-5.1211-3.4062-8.2266-3.4062-3.9062 0-7.5312 1.9453-9.6992 5.207-0.44531 0.66797-1.3477 0.85156-2.0156 0.40625-0.66797-0.44531-0.85156-1.3477-0.40625-2.0156 2.707-4.0781 7.2383-6.5078 12.121-6.5078 3.8828 0 7.5391 1.5117 10.285 4.2617 0.68359 0.68359 1.3008 1.4414 1.8359 2.2461 0.44531 0.66797 0.26172 1.5703-0.40625 2.0156-0.25 0.16016-0.53125 0.24219-0.80469 0.24219z" />
      <path d="m28.184 36.91c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266c0 4.8086-3.918 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164 0 3.207 2.6094 5.8164 5.8164 5.8164 3.207 0 5.8164-2.6094 5.8164-5.8164 0-3.207-2.6094-5.8164-5.8164-5.8164z" />
      <path d="m62.547 43.141c-0.48438 0-0.94922-0.24219-1.2188-0.66406-0.011719-0.015624-0.019531-0.03125-0.03125-0.046874-0.53125-0.85156-1.0703-1.543-1.6445-2.1133-2.1953-2.1953-5.1055-3.4062-8.1992-3.4102-3.9141 0-7.5391 1.9453-9.7031 5.207-0.44531 0.66797-1.3477 0.85156-2.0156 0.40625-0.66797-0.44531-0.85156-1.3477-0.40625-2.0156 2.707-4.0742 7.2344-6.5039 12.113-6.5039 3.8828 0.003906 7.5234 1.5156 10.27 4.2617 0.66797 0.66797 1.2891 1.4453 1.8867 2.3711 0.25 0.26172 0.40625 0.61719 0.40625 1.0078v0.050781c0 0.65234-0.43359 1.2266-1.0625 1.4023-0.13281 0.03125-0.26562 0.046875-0.39453 0.046875zm-1.1602-0.57812c0.003906 0.003906 0 0.003906 0 0zm-0.003907-0.003906c0.003907 0.003906 0.003907 0 0 0zm-0.007812-0.011719c0.003906 0.003906 0.007812 0.007813 0.011719 0.015625-0.003907-0.007812-0.007813-0.011719-0.011719-0.015625zm-0.003906-0.003906c0.003906 0.003906 0 0 0 0zm-0.070313-0.10156v0.003906c0.003907 0 0.003907 0 0-0.003906z" />
      <path d="m51.453 36.91c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266c0.003906 4.8086-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164 0 3.207 2.6094 5.8164 5.8164 5.8164s5.8164-2.6094 5.8164-5.8164c0.003907-3.207-2.6055-5.8164-5.8164-5.8164z" />
      <path d="m86.516 44.297c-0.53906 0-1.0586-0.30078-1.3086-0.82031-0.56641-1.1719-1.3242-2.2344-2.25-3.1602-2.1992-2.1953-5.1211-3.4062-8.2305-3.4062-4.1484 0-8.0117 2.2344-10.086 5.832-0.40234 0.69531-1.293 0.93359-1.9883 0.53125-0.69531-0.40234-0.93359-1.293-0.53125-1.9883 2.5938-4.4922 7.4219-7.2852 12.605-7.2852 3.8828 0 7.5391 1.5117 10.285 4.2617 1.1562 1.1562 2.1016 2.4844 2.8125 3.9492 0.35156 0.72266 0.046875 1.5938-0.67578 1.9414-0.20313 0.097656-0.42188 0.14453-0.63281 0.14453z" />
      <path d="m74.727 36.91c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266c0 4.8086-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164 0 3.207 2.6094 5.8164 5.8164 5.8164 3.207 0 5.8164-2.6094 5.8164-5.8164 0.003906-3.207-2.6094-5.8164-5.8164-5.8164z" />
      <path d="m52.91 80.547h-26.184c-0.80469 0-1.4531-0.65234-1.4531-1.4531 0-0.80469 0.65234-1.4531 1.4531-1.4531h26.184c0.80469 0 1.4531 0.65234 1.4531 1.4531s-0.65234 1.4531-1.4531 1.4531z" />
      <path d="m28.906 63.129c-0.27734 0-0.55469-0.078125-0.80469-0.24219-0.66797-0.44531-0.85156-1.3477-0.40625-2.0156 2.7109-4.0742 7.2383-6.5078 12.121-6.5078 3.8867 0 7.5391 1.5117 10.285 4.2617 0.37109 0.37109 0.71875 0.75781 1.0312 1.1484 0.50391 0.625 0.40234 1.543-0.22266 2.043-0.625 0.50391-1.543 0.40234-2.043-0.22266-0.24609-0.30859-0.52344-0.61328-0.82031-0.91016-2.1992-2.1992-5.1211-3.4102-8.2305-3.4102-3.9062 0-7.5312 1.9453-9.6992 5.207-0.27734 0.41797-0.73828 0.64844-1.2109 0.64844z" />
      <path d="m39.816 57.273c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266c0.003906 4.8125-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164s2.6094 5.8164 5.8164 5.8164c3.207 0 5.8164-2.6094 5.8164-5.8164 0.003907-3.207-2.6055-5.8164-5.8164-5.8164z" />
      <path d="m73.273 80.547h-26.184c-0.80469 0-1.4531-0.65234-1.4531-1.4531v-10.184c0-8.0195 6.5234-14.547 14.547-14.547 8.0195 0 14.547 6.5234 14.547 14.547v10.184c-0.003907 0.80078-0.65625 1.4531-1.457 1.4531zm-24.727-2.9102h23.273v-8.7266c0-6.418-5.2188-11.637-11.637-11.637-6.418 0-11.637 5.2188-11.637 11.637z" />
      <path d="m60.184 57.273c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164s2.6094 5.8164 5.8164 5.8164c3.207 0 5.8164-2.6094 5.8164-5.8164s-2.6094-5.8164-5.8164-5.8164z" />
      <path d="m95.09 80.547h-26.18c-0.80469 0-1.4531-0.65234-1.4531-1.4531 0-0.80469 0.65234-1.4531 1.4531-1.4531h24.727v-8.7266c0-3.1094-1.2109-6.0312-3.4102-8.2266-2.1953-2.2031-5.1172-3.4141-8.2266-3.4141-3.9062 0-7.5312 1.9453-9.6992 5.207-0.44531 0.66797-1.3477 0.85156-2.0156 0.40625-0.66797-0.44531-0.85156-1.3477-0.40625-2.0156 2.707-4.0742 7.2383-6.5078 12.121-6.5078 3.8867 0 7.5391 1.5117 10.285 4.2617 2.7461 2.7461 4.2617 6.3984 4.2617 10.285v10.184c0 0.80078-0.65234 1.4531-1.457 1.4531z" />
      <path d="m82 57.273c-4.8125 0-8.7266-3.9141-8.7266-8.7266s3.9141-8.7266 8.7266-8.7266 8.7266 3.9141 8.7266 8.7266-3.9141 8.7266-8.7266 8.7266zm0-14.547c-3.207 0-5.8164 2.6094-5.8164 5.8164s2.6094 5.8164 5.8164 5.8164 5.8164-2.6094 5.8164-5.8164-2.6094-5.8164-5.8164-5.8164z" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IconPen(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

export function IconHighlighter(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.828 0l-5.172-5.172a2 2 0 0 1 0-2.828L14 4" />
    </svg>
  );
}

export function IconEraser(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

export function IconLaser(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function IconGripVertical(props: IconProps) {
  return (
    <svg {...defaults} viewBox="7 3 10 18" {...props}>
      <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconArrowUpDown(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function IconMaximize(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconMinimize(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

export function IconZoomIn(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  );
}

export function IconMetronome(props: IconProps) {
  return (
    <svg {...defaults} {...props} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" id="Metronome--Streamline-Tabler" height="24" width="24">
      <path d="m14.153 8.188 -0.72 -3.236a2.493 2.493 0 0 0 -4.867 0L5.541 18.566A2 2 0 0 0 7.493 21h7.014a2 2 0 0 0 1.952 -2.434l-0.524 -2.357M11 18l9 -13" strokeWidth="2"></path>
      <path d="M19 5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" strokeWidth="2"></path>
    </svg>
  );
}

export function IconMic(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

export function IconTrumpet(props: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 650 650"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
      {...props}
    >
      <path d="M50 349c14,-13 29,-24 45,-32 17,-9 35,-14 53,-17l11 -1 7 7 19 20 0 0c3,3 7,4 12,4 4,0 8,-1 11,-4 4,-4 5,-8 5,-12 0,-4 -1,-9 -5,-12l-12 -13 -11 -10 6 -14c4,-7 8,-14 12,-20 5,-7 10,-13 16,-19l0 0c23,-23 51,-36 80,-40 25,-3 50,0 73,10l113 -113c-2,-5 -3,-10 -3,-15 0,-11 4,-22 12,-30l0 0 0 0 0 0 26 -26 0 0c8,-8 19,-12 30,-12 10,0 21,4 29,12l51 51 0 0c8,8 12,19 12,29 0,11 -4,22 -12,30l0 0 -26 26 0 0 0 0c-8,8 -19,12 -30,12 -5,0 -10,-1 -15,-3l-113 113c10,23 13,48 10,73 -4,29 -17,58 -40,80l0 0c-6,6 -12,11 -18,16 -7,4 -14,8 -21,12l-14 6 -10 -10 -13 -13c-3,-3 -8,-5 -12,-5 -4,0 -8,2 -11,5l0 0c-4,3 -5,7 -5,11 0,5 1,9 5,12l0 0 19 19 7 8 -1 10c-3,18 -8,36 -17,53 -8,16 -18,31 -32,45l0 0 0 0c-34,33 -77,50 -121,50 -44,0 -88,-17 -122,-50l0 0 0 0c-33,-34 -50,-78 -50,-122 0,-44 17,-87 50,-121zm64 6c-12,6 -24,14 -34,24 -25,25 -38,58 -38,91 0,33 13,67 38,92l0 0 0 0c25,25 59,38 92,38 33,0 66,-13 91,-38l0 0 0 0c10,-10 18,-22 25,-34 4,-10 8,-20 10,-30l-11 -11 0 0c-12,-12 -18,-27 -18,-42 0,-15 6,-30 18,-41l0 0c11,-12 26,-17 41,-17 15,0 30,5 42,17l1 1 2 -1c5,-3 9,-7 13,-11l0 0c16,-16 25,-35 28,-56 3,-21 -1,-42 -12,-61l-8 -14 11 -11 136 -136 15 -15 15 15 3 3 26 -26 -50 -50 -26 26 4 3 15 15 -15 15 -137 136 -11 11 -14 -8c-19,-11 -40,-15 -61,-12 -21,3 -40,12 -56,28l0 0c-4,4 -8,8 -11,13l-1 2 1 1c12,12 17,27 17,42 0,15 -5,30 -17,41 -11,12 -26,18 -41,18 -15,0 -30,-6 -42,-18l0 0 -11 -11c-10,2 -20,6 -30,11z" />
    </svg>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

export function IconGraduationCap(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

export function IconFileText(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.432 0l6.586-6.586a2.426 2.426 0 0 0 0-3.432z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
      <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconArrowDown(props: IconProps) {
  // Ícone típico de download: seta para baixo com "chão"
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3v14" />
      <path d="M6 13l6 6 6-6" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export function IconOffline(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function IconLink(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconAlertCircle(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C20.08 11.03 16.55 8 12.5 8z"/>
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconTextSize(props: IconProps) {
  return (
    <svg {...defaults} {...props} fill="currentColor" stroke="none">
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        A
      </text>
    </svg>
  );
}

export function IconGoogle(props: IconProps) {
  return (
    <svg {...props} width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
