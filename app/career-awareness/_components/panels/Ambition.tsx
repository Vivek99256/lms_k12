export function Ambition() {
  return (
    <div className="bg-card rounded-b-[20px] md:rounded-b-[68px]">
      <div className="pt-[10%] md:pt-[10%] pb-8 p-3 md:p-10 md:text-[20px] 2xl:text-[24px]">
        <h2 className="font-bold">
          Expecting to have professional/managerial employment at age 30
        </h2>
        <h2 className="mt-[10px]">
          Career ambition, defined as the expectation of working in a job
          classified as managerial or professional, such as higher earnings,
          reduced unemployment, and greater career satisfaction, even after
          controlling for background variables
        </h2>
        <div className="flex lg:flex-row flex-col-reverse items-center w-[100%] mt-[40px]">
          <div className="lg:w-[60%]">
            <h2 className="text-primary font-bold">Understand Yourself:</h2>
            <p className="my-2">
              Reflect on your passions, strengths, and values. Equally important are your values. Determine what matters most to you in your work life.
            </p>
            <h2 className="text-secondary-foreground font-bold">Establish Objectives:</h2>
            <p className="my-2">
              Define achievable and specific goals, such as earning a promotion
              or acquiring a new skill. Setting clear, specific goals provides direction and helps you measure your progress, making it easier to stay motivated and on track toward achieving your career ambitions.
            </p>
          </div>
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-right m-auto mb-10 lg:mb-0 md:max-w-[600px] lg:w-[330px]" src="/images/career-awareness/pana.png" alt="pana" />
          </div>
        </div>

        <div className="flex lg:flex-row flex-col items-center w-[100%] mt-[30px]">
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-left m-auto md:max-w-[600px] lg:w-[430px]" src="/images/career-awareness/rafiki.png" alt="rafiki" />
          </div>
          <div className="lg:w-[60%] mt-[50px] lg:mt-0">
            <h2 className="text-primary font-bold">Understand Yourself:</h2>
            <p className="my-2">
              Identifying these passions helps guide you towards a career that not only interests you but also keeps you motivated and fulfilled
            </p>
            <h2 className="text-secondary-foreground font-bold">Establish Objectives:</h2>
            <p className="my-2">
              Define achievable and specific goals, such as earning a promotion
              or acquiring a new skill. If your goal is to develop a new skill, identify the necessary resources and steps to master it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
