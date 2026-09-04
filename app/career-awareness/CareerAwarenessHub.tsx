'use client';

import { useState } from 'react';
import { HeaderList } from './_components/HeaderList';
import { Certainty } from './_components/panels/Certainty';
import { Ambition } from './_components/panels/Ambition';
import { Alignment } from './_components/panels/Alignment';
import { Originality } from './_components/panels/Originality';
import { careerOptions } from './_lib/constants';

const TAB_TITLES = ['>> Career certainty', '>> Career Ambition', '>> Career Alignment', '>> Career originality'];

export default function CareerAwarenessHub() {
  const [show, setShow] = useState(0);

  return (
    <div className="container mx-auto px-4">
      <div className="bg-[#0D6EFD] pt-[34px] rounded-[10px] md:rounded-[48px] my-5 md:my-10">
        <div className="flex justify-center md:space-x-6">
          {careerOptions.map((option, index) => (
            <HeaderList
              key={option.label}
              option={option}
              onClick={() => setShow(index)}
              isSelected={show === index}
            />
          ))}
        </div>
        <div className="w-[100%] mt-[42px] relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
          <img
            className="w-[100%] h-[336px] object-cover rounded-t-[28px] md:rounded-t-[48px]"
            src="/images/career-awareness/image 9.png"
            alt=""
          />
          <div className="absolute top-1/2 -translate-y-1/2 md:-translate-y-0 md:top-[85%] 2xl:top-[80%] left-1/2 -translate-x-1/2">
            <div className="w-[300px] md:w-[600px] 2xl:w-[890px] rounded-[10px] md:rounded-[80px] bg-muted p-2 md:p-3 2xl:p-4 px-6 md:px-16">
              <h2 className="border-b-2 w-fit border-b-foreground text-foreground text-[17px] md:text-[22px] 2xl:text-[32px] leading-tight font-[600]">
                Thinking In Career Plan
              </h2>
              <h3 className="text-center text-[#0D6EFD] text-[17px] md:text-[22px] 2xl:text-[32px] mt-[10px] font-bold">
                {TAB_TITLES[show]}
              </h3>
            </div>
          </div>
        </div>
        {show === 0 && <Certainty />}
        {show === 1 && <Ambition />}
        {show === 2 && <Alignment />}
        {show === 3 && <Originality />}
      </div>
    </div>
  );
}
